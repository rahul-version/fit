document.addEventListener('DOMContentLoaded', () => {

  // ==========================================================================
  // NAVBAR SCROLL TRANSITION
  // ==========================================================================
  const header = document.getElementById('header');
  
  const handleScroll = () => {
    if (!header) return;
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
      // If we are on home pages, adjust active links or colors
    } else {
      // Check if we are on pages that should always stay scrolled/solid
      if (!header.classList.contains('always-scrolled')) {
        header.classList.remove('scrolled');
      }
    }
  };
  
  window.addEventListener('scroll', handleScroll);
  handleScroll();

  // ==========================================================================
  // MOBILE HAMBURGER MENU
  // ==========================================================================
  const hamburger = document.getElementById('hamburger');
  const navMenu = document.getElementById('nav-menu');
  const navLinks = document.querySelectorAll('.nav-link');

  const toggleMenu = () => {
    if (hamburger && navMenu) {
      hamburger.classList.toggle('active');
      navMenu.classList.toggle('active');
    }
  };

  const closeMenu = () => {
    if (hamburger && navMenu) {
      hamburger.classList.remove('active');
      navMenu.classList.remove('active');
    }
  };

  if (hamburger) {
    hamburger.addEventListener('click', toggleMenu);
  }
  
  navLinks.forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('click', (e) => {
    if (hamburger && navMenu && !hamburger.contains(e.target) && !navMenu.contains(e.target)) {
      closeMenu();
    }
  });

  // ==========================================================================
  // HERO SECTION INTRINSIC FADE IN
  // ==========================================================================
  const heroContent = document.getElementById('hero-content');
  if (heroContent) {
    setTimeout(() => {
      heroContent.classList.add('active');
    }, 150);
  }

  // ==========================================================================
  // STATS BAR COUNTER ANIMATION
  // ==========================================================================
  const counters = document.querySelectorAll('.counter');
  const counterDuration = 2000;

  const startCounter = (counter) => {
    const target = parseInt(counter.getAttribute('data-target'), 10);
    const start = 0;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / counterDuration, 1);
      
      const easeProgress = progress * (2 - progress);
      const currentValue = Math.floor(easeProgress * (target - start) + start);
      
      const suffix = (counter.parentElement.lastElementChild.textContent.toLowerCase() === 'years') ? '' : '+';
      counter.textContent = currentValue + suffix;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        counter.textContent = target + suffix;
      }
    };

    requestAnimationFrame(animate);
  };

  // ==========================================================================
  // INTERSECTION OBSERVER FOR SCROLL ANIMATIONS
  // ==========================================================================
  const animationOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
  };

  const animationObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate');
        observer.unobserve(entry.target);
      }
    });
  }, animationOptions);

  // Expose function globally to let plans.js & trainers.js trigger it after loads
  window.bindScrollAnimations = () => {
    const fadeElements = document.querySelectorAll(
      '.equipment-card, .why-card, .pricing-card, .testimonial-card, .trainer-card, .cta-box, .info-item'
    );
    fadeElements.forEach(el => {
      if (!el.classList.contains('animate')) {
        animationObserver.observe(el);
      }
    });
  };

  // Run once initially
  window.bindScrollAnimations();

  // Vision Section Grid Slide-In
  const visionGrid = document.getElementById('vision-grid');
  if (visionGrid) {
    const visionObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate');
          observer.unobserve(entry.target);
        }
      });
    }, animationOptions);
    visionObserver.observe(visionGrid);
  }

  // Stats Counter Intersection Observer
  const statsBar = document.getElementById('stats-bar');
  if (statsBar) {
    let countersStarted = false;
    const statsObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !countersStarted) {
          countersStarted = true;
          counters.forEach(counter => startCounter(counter));
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.2 });
    statsObserver.observe(statsBar);
  }

  // ==========================================================================
  // ACTIVE NAV LINK ON SCROLL
  // ==========================================================================
  const sections = document.querySelectorAll('main section[id]');
  
  const activateNavLink = () => {
    const scrollY = window.pageYOffset;

    sections.forEach(current => {
      const sectionHeight = current.offsetHeight;
      const sectionTop = current.offsetTop - 150;
      const sectionId = current.getAttribute('id');
      const activeLink = document.querySelector(`.nav-menu a[href*=${sectionId}]`);

      if (activeLink) {
        if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
          activeLink.classList.add('active-link');
        } else {
          activeLink.classList.remove('active-link');
        }
      }
    });
  };

  window.addEventListener('scroll', activateNavLink);
});
