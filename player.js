let hls = null;
let currentQuality = "M3U8_AUTO_720";
const API_BASE_URL = "https://api.ronnieverse.site";
const PROXY_WORKERS = [
  "https://terabox-hls-proxy.mohdamir7505.workers.dev",
  "https://terabox-hls-proxy-2.terbox-url-fixer.workers.dev",
  "https://terabox-hls-proxy-3.eron8318.workers.dev",
  "https://terabox-hls-proxy-4.ronnie6667770.workers.dev",
];
let requestCounter = Math.floor(Math.random() * PROXY_WORKERS.length);

function updateStatus(msg) {
  const status = document.getElementById("status");
  if (!msg) {
    status.style.display = "none";
  } else {
    status.textContent = msg;
    status.style.display = "block";
  }

  // Simple loader toggle (optional)
  const loader = document.getElementById("loader");
  const spinner = document.querySelector(".spinner");
  if (
    msg === "Wait a second..." ||
    msg === "Video fetching..." ||
    msg === "Failed to load" ||
    msg === "No video source found"
  ) {
    loader.style.display = "block";
  } else {
    spinner.style.display = "none";
    // loader.style.display = "none";
  }
}

function getNextProxyWorker() {
  const index = requestCounter % PROXY_WORKERS.length;
  requestCounter++;
  return PROXY_WORKERS[index];
}

function cleanupBlobUrls() {
  if (window.currentBlobUrl) {
    URL.revokeObjectURL(window.currentBlobUrl);
    window.currentBlobUrl = null;
  }
}

async function fetchM3U8FromAPI(shareUrl, quality) {
  try {
    updateStatus("Video fetching...");
    const q = quality.replace("M3U8_AUTO_", "");
    const res = await fetch(
      `${API_BASE_URL}/get_m3u8?url=${encodeURIComponent(
        shareUrl
      )}&quality=${q}`
    );
    if (!res.ok) throw new Error("API Error");
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/vnd.apple.mpegurl")) {
      const m3u8Text = await res.text();
      const blob = new Blob([m3u8Text], {
        type: "application/vnd.apple.mpegurl",
      });
      const blobUrl = URL.createObjectURL(blob);
      window.currentBlobUrl = blobUrl;
      return blobUrl;
    } else {
      const json = await res.json();
      return json.m3u8_url;
    }
  } catch (e) {
    updateStatus("Error: " + e.message);
    return null;
  }
}

async function fetchFromStartParam(startUrl) {
  try {
    updateStatus("Video fetching...");
    if (!startUrl.startsWith("http")) {
      startUrl = `https://www.1024tera.com/sharing/link?surl=${startUrl}`;
    }
    const targetUrl = `${API_BASE_URL}/get_m3u8_stream_fast/${encodeURIComponent(
      startUrl
    )}`;
    const res = await fetch(targetUrl);
    if (!res.ok) throw new Error("Start param fetch error");
    const m3u8Text = await res.text();
    const blob = new Blob([m3u8Text], {
      type: "application/vnd.apple.mpegurl",
    });
    const blobUrl = URL.createObjectURL(blob);
    window.currentBlobUrl = blobUrl;
    return blobUrl;
  } catch (e) {
    updateStatus("Error: " + e.message);
    return null;
  }
}

function goFullScreen(video) {
  if (video.requestFullscreen) {
    video.requestFullscreen();
  } else if (video.webkitRequestFullscreen) {
    video.webkitRequestFullscreen();
  } else if (video.msRequestFullscreen) {
    video.msRequestFullscreen();
  }
}

function loadVideo(m3u8Url) {
  const video = document.getElementById("videoPlayer");
  video.style.display = "block";
  const currentTime = video.currentTime;
  const wasPlaying = !video.paused && video.readyState > 0;

  updateStatus("Video fetching...");
  if (Hls.isSupported()) {
    if (hls) hls.destroy();
    hls = new Hls({
      xhrSetup: function (xhr, url) {
        if (
          url.includes("terabox") ||
          url.includes("freeterabox") ||
          url.includes("1024tera")
        ) {
          const proxy = getNextProxyWorker();
          const finalUrl = `${proxy}/?url=${encodeURIComponent(url)}`;
          xhr.open("GET", finalUrl, true);
        } else {
          xhr.open("GET", url, true);
        }
        xhr.withCredentials = false;
      },
    });
    hls.on(Hls.Events.MANIFEST_PARSED, function () {
      video.currentTime = currentTime;
      updateStatus(""); // hide status
      goFullScreen(video);
      if (wasPlaying) video.play().catch(() => {});
    });
    hls.on(Hls.Events.ERROR, function (e, data) {
      console.error("HLS Error:", data);
      if (data.fatal) updateStatus("Stream error: " + data.type);
    });
    hls.loadSource(m3u8Url);
    hls.attachMedia(video);
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = m3u8Url;
    video.addEventListener("loadedmetadata", function () {
      video.currentTime = currentTime;
      updateStatus(""); // hide status
      goFullScreen(video);
      if (wasPlaying) video.play().catch(() => {});
    });
  } else {
    updateStatus("HLS not supported");
  }
}

async function init() {
  updateStatus("Wait a second...");
  const params = new URLSearchParams(window.location.search);
  const shareUrl = params.get("share");
  const startUrl = params.get("start");
  cleanupBlobUrls();

  setTimeout(async () => {
    try {
      if (shareUrl) {
        const url = await fetchM3U8FromAPI(shareUrl, currentQuality);
        if (url) loadVideo(url);
        else updateStatus("Failed to load from share URL");
      } else if (startUrl) {
        const url = await fetchFromStartParam(startUrl);
        if (url) loadVideo(url);
        else updateStatus("Failed to load");
      } else {
        updateStatus("No video source found");
      }
    } catch (err) {
      updateStatus("Unexpected error: " + err.message);
    }
  }, 4000);
}

window.addEventListener("load", init);
window.addEventListener("beforeunload", () => {
  cleanupBlobUrls();
  if (hls) hls.destroy();
});
