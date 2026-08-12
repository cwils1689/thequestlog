/* confetti.js — tiny, dependency-free celebration burst on <canvas id="confettiCanvas">.
   No external libs, no network calls. */

(function (global) {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  let rafId = null;

  const COLORS = ['#FFC93C', '#E0A400', '#3D6FD6', '#2EA36B', '#E0562F', '#2EC4B6'];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function burst(opts) {
    if (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const options = Object.assign({ count: 90, spread: 1, originY: 0.35 }, opts || {});
    resize();
    canvas.hidden = false;
    const cx = canvas.width / 2;
    const cy = canvas.height * options.originY;
    for (let i = 0; i < options.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (2 + Math.random() * 6) * options.spread;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        size: 4 + Math.random() * 5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.3,
        life: 0,
        maxLife: 70 + Math.random() * 40,
      });
    }
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.vy += 0.15; // gravity
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      p.life++;
      const alpha = Math.max(0, 1 - p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    });
    particles = particles.filter((p) => p.life < p.maxLife);
    if (particles.length) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = null;
      canvas.hidden = true;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  global.QuestConfetti = { burst };
})(window);
