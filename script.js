(() => {
  "use strict";

  const methods = [
    { name: "BiLi", id: "canvas-bili", color: "#58e1b5" },
    { name: "LightLoc", id: "canvas-lightloc", color: "#f2ac81" },
    { name: "RALoc", id: "canvas-raloc", color: "#86bce3" },
    { name: "GTRLoc", id: "canvas-gtrloc", color: "#d5afdb" },
  ];
  const playButton = document.getElementById("play-button");
  const restartButton = document.getElementById("restart-button");
  const range = document.getElementById("frame-range");
  const readout = document.getElementById("frame-readout");
  const status = document.getElementById("replay-status");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let data;
  let view;
  let frame = 0;
  let playing = false;
  let lastAdvance = 0;

  function makeView(payload) {
    const points = payload.ground_truth_xy.concat(...payload.series.map(item => item.xy));
    const xs = points.map(point => point[0]);
    const ys = points.map(point => point[1]);
    const minX = Math.min(...xs) - 7;
    const maxX = Math.max(...xs) + 7;
    const minY = Math.min(...ys) - 7;
    const maxY = Math.max(...ys) + 7;
    const width = 640;
    const height = 410;
    const pad = 35;
    const scale = Math.min((width - pad * 2) / (maxX - minX), (height - pad * 2) / (maxY - minY));
    const ox = (width - (maxX - minX) * scale) / 2;
    const oy = (height - (maxY - minY) * scale) / 2;
    return {
      map(point) {
        return [ox + (point[0] - minX) * scale, height - oy - (point[1] - minY) * scale];
      },
    };
  }

  function line(ctx, points, end) {
    const count = Math.min(points.length, end + 1);
    if (count < 2) return;
    const [firstX, firstY] = view.map(points[0]);
    ctx.beginPath();
    ctx.moveTo(firstX, firstY);
    for (let i = 1; i < count; i++) {
      const [x, y] = view.map(points[i]);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawBackdrop(ctx) {
    ctx.fillStyle = "#213845";
    ctx.fillRect(0, 0, 640, 410);
    ctx.strokeStyle = "rgba(153, 191, 196, .065)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= 640; x += 38) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 410); ctx.stroke();
    }
    for (let y = 0; y <= 410; y += 38) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(640, y); ctx.stroke();
    }
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#172d36";
    ctx.lineWidth = 61;
    line(ctx, data.ground_truth_xy, data.frame_count - 1);
    ctx.strokeStyle = "#3d5962";
    ctx.lineWidth = 50;
    line(ctx, data.ground_truth_xy, data.frame_count - 1);
    ctx.strokeStyle = "rgba(227, 235, 217, .2)";
    ctx.lineWidth = 1.5;
    line(ctx, data.ground_truth_xy, data.frame_count - 1);
    ctx.restore();
    ctx.fillStyle = "rgba(194, 219, 217, .53)";
    ctx.font = "700 10px Arial, sans-serif";
    ctx.fillText("START", ...view.map(data.ground_truth_xy[0]).map((v, i) => v + (i === 0 ? 9 : -9)));
    ctx.fillText("END", ...view.map(data.ground_truth_xy[data.frame_count - 1]).map((v, i) => v + (i === 0 ? 9 : -9)));
  }

  function drawCar(ctx, point, index, color) {
    const [x, y] = view.map(point);
    const before = view.map(data.ground_truth_xy[Math.max(0, index - 4)]);
    const after = view.map(data.ground_truth_xy[Math.min(data.frame_count - 1, index + 4)]);
    const angle = Math.atan2(after[1] - before[1], after[0] - before[0]) + Math.PI / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.beginPath(); ctx.ellipse(2, 4, 12, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.strokeStyle = "#f3fffa";
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.roundRect(-8, -15, 16, 29, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#24404b";
    ctx.beginPath(); ctx.roundRect(-5, -8, 10, 10, 2); ctx.fill();
    ctx.fillStyle = "#f7f4d8";
    ctx.fillRect(-5, -14, 3, 2); ctx.fillRect(2, -14, 3, 2);
    ctx.restore();
  }

  function drawPanel(method, series) {
    const canvas = document.getElementById(method.id);
    const ctx = canvas.getContext("2d");
    drawBackdrop(ctx);
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = method.color;
    ctx.lineWidth = 3.25;
    ctx.shadowColor = method.color;
    ctx.shadowBlur = 6;
    line(ctx, series.xy, frame);
    ctx.restore();
    drawCar(ctx, series.xy[frame], frame, method.color);
    ctx.fillStyle = "rgba(14, 34, 43, .88)";
    ctx.fillRect(11, 11, 122, 24);
    ctx.fillStyle = "#d5e7e6";
    ctx.font = "700 11px Arial, sans-serif";
    ctx.fillText("FRAME " + (data.frame_start_zero_based + frame), 20, 27);
  }

  function render() {
    if (!data) return;
    methods.forEach(method => {
      const series = data.series.find(item => item.name === method.name);
      drawPanel(method, series);
    });
    range.value = String(frame);
    readout.textContent = `Frame ${data.frame_start_zero_based + frame} / ${data.frame_end_zero_based_inclusive}`;
  }

  function setPlaying(value) {
    playing = value;
    playButton.textContent = value ? "Ⅱ" : "▶";
    playButton.setAttribute("aria-label", value ? "Pause replay" : "Play replay");
    lastAdvance = performance.now();
    if (value) requestAnimationFrame(tick);
  }

  function tick(now) {
    if (!playing || !data) return;
    if (now - lastAdvance >= 44) {
      frame = (frame + 1) % data.frame_count;
      lastAdvance = now;
      render();
    }
    requestAnimationFrame(tick);
  }

  playButton.addEventListener("click", () => { if (data) setPlaying(!playing); });
  restartButton.addEventListener("click", () => { if (data) { frame = 0; render(); } });
  range.addEventListener("input", () => { if (data) { frame = Number(range.value); render(); } });
  reducedMotion.addEventListener("change", event => { if (event.matches && playing) setPlaying(false); });

  fetch("assets/trajectory-0300.json")
    .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
    .then(payload => {
      if (payload.frame_count !== 400 || payload.series.length !== 4 || payload.series.some(item => item.xy.length !== 400)) throw new Error("Unexpected trajectory data");
      data = payload;
      view = makeView(payload);
      frame = 100;
      render();
      status.textContent = "Replay uses the supplied raw 2D predictions. Drag the timeline or pause to inspect a frame.";
      if (!reducedMotion.matches) setPlaying(true);
    })
    .catch(error => {
      status.textContent = `Trajectory replay could not load (${error.message}). Open this page through a local web server or GitHub Pages.`;
      playButton.disabled = true;
      restartButton.disabled = true;
      range.disabled = true;
    });
})();
