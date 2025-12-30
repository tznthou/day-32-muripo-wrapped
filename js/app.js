/**
 * Muripo Wrapped 2025 - Main Application
 */

// =====================================================
// Storage Helper (M04: localStorage 容錯)
// =====================================================
const Storage = {
  get(key, defaultValue = null) {
    try {
      return localStorage.getItem(key) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch { /* ignore */ }
  }
};

// =====================================================
// Audio Module
// =====================================================
const Audio = {
  context: null,
  enabled: true,

  init() {
    this.enabled = Storage.get('muripoWrapped_sound') !== 'false';
    this.updateUI();

    // H01: 等待使用者第一次互動後啟動 AudioContext
    document.addEventListener('click', () => this.resumeContext(), { once: true });
    document.addEventListener('keydown', () => this.resumeContext(), { once: true });
  },

  getContext() {
    if (!this.context) {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.context;
  },

  // H01: 處理 autoplay policy
  resumeContext() {
    if (this.context && this.context.state === 'suspended') {
      this.context.resume().catch(() => {});
    }
  },

  toggle() {
    this.enabled = !this.enabled;
    Storage.set('muripoWrapped_sound', this.enabled);
    this.updateUI();
    // 切換時也嘗試 resume
    this.resumeContext();
  },

  updateUI() {
    const btn = document.getElementById('soundToggle');
    if (btn) {
      btn.querySelector('.sound-on').hidden = !this.enabled;
      btn.querySelector('.sound-off').hidden = this.enabled;
    }
  },

  playTick() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.value = 800;
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) { /* ignore */ }
  },

  playSlideChange() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) { /* ignore */ }
  },

  playSuccess() {
    if (!this.enabled) return;
    try {
      const ctx = this.getContext();
      const notes = [523, 659, 784]; // C5, E5, G5

      notes.forEach((freq, i) => {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

          osc.connect(gain).connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
        }, i * 100);
      });
    } catch (e) { /* ignore */ }
  }
};

// =====================================================
// Animation Module
// =====================================================
const Animations = {
  /**
   * Animate number counting
   */
  countUp(element, target, duration = 1500) {
    const start = 0;
    const startTime = performance.now();

    const tick = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing: ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (target - start) * eased);

      element.textContent = current.toLocaleString();

      // Play tick sound occasionally
      if (progress < 1 && Math.random() < 0.1) {
        Audio.playTick();
      }

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        element.textContent = target.toLocaleString();
      }
    };

    requestAnimationFrame(tick);
  },

  /**
   * Animate bar growth
   */
  growBars(container, maxValue) {
    const bars = container.querySelectorAll('.bar-fill');
    bars.forEach((bar, i) => {
      const value = parseInt(bar.parentElement.parentElement.dataset.value ||
                            bar.dataset.value ||
                            bar.parentElement.querySelector('.bar-value')?.textContent?.replace(/,/g, '') || 0);
      const percentage = (value / maxValue) * 100;

      setTimeout(() => {
        bar.style.width = `${percentage}%`;
      }, i * 100);
    });
  },

  /**
   * Animate weekly progress bars
   */
  growWeeklyBars() {
    const bars = document.querySelectorAll('.week-fill');
    const maxValue = 7; // Max projects per week

    bars.forEach((bar, i) => {
      const value = parseInt(bar.dataset.value);
      const percentage = (value / maxValue) * 100;

      setTimeout(() => {
        bar.style.width = `${percentage}%`;
      }, i * 150);
    });
  }
};

// =====================================================
// Slides Controller
// =====================================================
const Slides = {
  container: null,
  slides: [],
  currentIndex: 0,
  observer: null,

  init() {
    this.container = document.querySelector('.slides-container');
    this.slides = document.querySelectorAll('.slide');

    this.setupIntersectionObserver();
    this.setupProgressNav();
    this.setupKeyboardNav();

    // Animate first slide immediately
    setTimeout(() => {
      this.animateSlide(this.slides[0]);
    }, 500);
  },

  setupIntersectionObserver() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const slideIndex = parseInt(entry.target.dataset.slide);
            this.onSlideEnter(entry.target, slideIndex);
          }
        });
      },
      { threshold: 0.5 }
    );

    this.slides.forEach((slide) => this.observer.observe(slide));
  },

  setupProgressNav() {
    const dots = document.querySelectorAll('.progress-dot');
    dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        const slideIndex = parseInt(dot.dataset.slide);
        this.goToSlide(slideIndex);
      });
    });
  },

  setupKeyboardNav() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        this.nextSlide();
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        this.prevSlide();
      }
    });
  },

  onSlideEnter(slide, index) {
    if (this.currentIndex !== index) {
      this.currentIndex = index;
      Audio.playSlideChange();
    }

    this.updateProgressNav(index);
    this.animateSlide(slide);

    // H03: 通知螢幕閱讀器頁面變更
    this.announceSlide(index);
  },

  // H03: ARIA 通知
  announceSlide(index) {
    const ariaLive = document.getElementById('ariaLive');
    if (!ariaLive) return;

    const announcements = [
      'Muripo Wrapped 2025，32 天的程式冒險',
      '你完成了 31 個專案',
      '你總共寫了 112,928 行程式碼',
      '你的語言版圖，JavaScript 是主戰場',
      '專案類型，你是 Web 狂熱者',
      '愛用技術 Top 5，資料視覺化是最佳拍檔',
      '你的創作節奏，每週 7 個專案不間斷',
      '亮點專案展示',
      '基礎建設成就',
      '解鎖成就徽章',
      '旅程結語，每天做一點就能走很遠'
    ];

    ariaLive.textContent = announcements[index] || `第 ${index + 1} 頁`;
  },

  updateProgressNav(index) {
    const dots = document.querySelectorAll('.progress-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
  },

  animateSlide(slide) {
    if (slide.dataset.animated === 'true') return;
    slide.dataset.animated = 'true';

    // Trigger slide-specific animations
    const slideIndex = parseInt(slide.dataset.slide);

    // Count up animations for number elements
    const numbers = slide.querySelectorAll('[data-target]');
    numbers.forEach((el) => {
      const target = parseInt(el.dataset.target, 10);
      if (isNaN(target) || target < 0) {
        console.error('Invalid data-target value:', el.dataset.target);
        return;
      }
      Animations.countUp(el, target);
    });

    // Bar chart animations
    if (slideIndex === 3) {
      // Language bars
      Animations.growBars(slide, 25533); // JS is max
    }

    if (slideIndex === 4) {
      // Type bars
      Animations.growBars(slide, 24); // Web is max
    }

    if (slideIndex === 6) {
      // Weekly progress
      Animations.growWeeklyBars();
    }

    // Finale slide
    if (slideIndex === 10) {
      setTimeout(() => Audio.playSuccess(), 500);
    }
  },

  goToSlide(index) {
    if (index < 0 || index >= this.slides.length) return;
    this.slides[index].scrollIntoView({ behavior: 'smooth' });
  },

  nextSlide() {
    this.goToSlide(this.currentIndex + 1);
  },

  prevSlide() {
    this.goToSlide(this.currentIndex - 1);
  },

  // H05: 清理 IntersectionObserver
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
};

// =====================================================
// Share Module
// =====================================================
const Share = {
  init() {
    const downloadBtn = document.getElementById('downloadBtn');
    const shareBtn = document.getElementById('shareBtn');

    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => this.downloadCard());
    }

    if (shareBtn) {
      shareBtn.addEventListener('click', () => this.shareToTwitter());
    }
  },

  async downloadCard() {
    const card = document.getElementById('shareCard');
    if (!card || typeof html2canvas === 'undefined') {
      alert('無法生成卡片，請稍後再試');
      return;
    }

    let wrapper = null;

    try {
      // Create a wrapper with proper dimensions for OG image
      wrapper = document.createElement('div');
      wrapper.style.cssText = `
        width: 1200px;
        height: 630px;
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 60px;
        position: fixed;
        left: -9999px;
        top: 0;
      `;

      const cardClone = card.cloneNode(true);
      cardClone.style.cssText = `
        width: 100%;
        max-width: 800px;
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border: 3px solid #fbbf24;
        border-radius: 24px;
        padding: 48px;
        font-family: 'Noto Sans TC', system-ui, sans-serif;
      `;

      // Style inner elements
      const header = cardClone.querySelector('.share-header');
      if (header) {
        header.style.cssText = 'font-size: 48px; font-weight: 900; color: #fbbf24; letter-spacing: 0.05em;';
      }

      const stats = cardClone.querySelector('.share-stats');
      if (stats) {
        stats.style.cssText = 'font-size: 36px; color: #f8fafc; font-family: "JetBrains Mono", monospace;';
      }

      const badges = cardClone.querySelector('.share-badges');
      if (badges) {
        badges.style.cssText = 'display: flex; justify-content: center; gap: 16px; margin: 24px 0;';
        badges.querySelectorAll('.share-badge').forEach(badge => {
          badge.style.cssText = 'background: #334155; padding: 8px 24px; border-radius: 999px; font-size: 18px; color: #94a3b8;';
        });
      }

      const footer = cardClone.querySelector('.share-footer');
      if (footer) {
        footer.style.cssText = 'font-size: 24px; color: #64748b; font-family: "JetBrains Mono", monospace;';
      }

      const divider = cardClone.querySelector('.share-divider');
      if (divider) {
        divider.style.cssText = 'width: 60%; height: 2px; background: #64748b; margin: 24px auto;';
      }

      const inner = cardClone.querySelector('.share-card-inner');
      if (inner) {
        inner.style.cssText = 'text-align: center;';
      }

      wrapper.appendChild(cardClone);
      document.body.appendChild(wrapper);

      const canvas = await html2canvas(wrapper, {
        width: 1200,
        height: 630,
        scale: 2,
        useCORS: true,
        backgroundColor: '#0f172a'
      });

      // Download
      const link = document.createElement('a');
      link.download = 'muripo-wrapped-2025.png';
      link.href = canvas.toDataURL('image/png');
      link.click();

      Audio.playSuccess();
    } catch (error) {
      console.error('Failed to generate card:', error);
      alert('生成卡片失敗，請稍後再試');
    } finally {
      // 確保 wrapper 一定被移除
      if (wrapper && wrapper.parentNode) {
        document.body.removeChild(wrapper);
      }
    }
  },

  shareToTwitter() {
    const text = encodeURIComponent(
      '🎄 My Muripo Wrapped 2025\n\n' +
      '31 專案 │ 112,928 行程式碼\n' +
      '連續 31 天的程式冒險\n\n' +
      '#MuripoWrapped #Coding #Developer'
    );
    const url = encodeURIComponent('https://tznthou.github.io/day-32-muripo-wrapped/');
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  }
};

// =====================================================
// Initialize
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  Audio.init();
  Slides.init();
  Share.init();

  // Sound toggle
  const soundToggle = document.getElementById('soundToggle');
  if (soundToggle) {
    soundToggle.addEventListener('click', () => Audio.toggle());
  }

  console.log('🎄 Muripo Wrapped 2025 initialized');
});
