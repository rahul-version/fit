document.addEventListener('DOMContentLoaded', () => {

  // ==========================================================================
  // NAVBAR SCROLL TRANSITION
  // ==========================================================================
  const header = document.getElementById('header');
  
  const handleScroll = () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };
  
  window.addEventListener('scroll', handleScroll);
  // Run once initially on load to handle refreshed/scrolled state
  handleScroll();

  // ==========================================================================
  // MOBILE HAMBURGER MENU
  // ==========================================================================
  const hamburger = document.getElementById('hamburger');
  const navMenu = document.getElementById('nav-menu');
  const navLinks = document.querySelectorAll('.nav-link');

  const toggleMenu = () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
  };

  const closeMenu = () => {
    hamburger.classList.remove('active');
    navMenu.classList.remove('active');
  };

  hamburger.addEventListener('click', toggleMenu);
  
  navLinks.forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Close menu when clicking outside of it
  document.addEventListener('click', (e) => {
    if (!hamburger.contains(e.target) && !navMenu.contains(e.target)) {
      closeMenu();
    }
  });

  // ==========================================================================
  // HERO SECTION INTRINSIC FADE IN
  // ==========================================================================
  const heroContent = document.getElementById('hero-content');
  if (heroContent) {
    // Small timeout to allow styling render and trigger smooth transition
    setTimeout(() => {
      heroContent.classList.add('active');
    }, 150);
  }

  // ==========================================================================
  // STATS BAR COUNTER ANIMATION
  // ==========================================================================
  const counters = document.querySelectorAll('.counter');
  const counterDuration = 2000; // 2 seconds animation duration

  const startCounter = (counter) => {
    const target = parseInt(counter.getAttribute('data-target'), 10);
    const start = 0;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / counterDuration, 1);
      
      // Easing function outQuad for smooth deceleration
      const easeProgress = progress * (2 - progress);
      const currentValue = Math.floor(easeProgress * (target - start) + start);
      
      // Add '+' sign for non-year metrics
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
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  };

  const animationObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate');
        observer.unobserve(entry.target);
      }
    });
  }, animationOptions);

  // Targets for fade-up/in animations
  const fadeElements = document.querySelectorAll(
    '.equipment-card, .why-card, .pricing-card, .testimonial-card, .cta-box, .info-item'
  );
  fadeElements.forEach(el => animationObserver.observe(el));

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
    }, { threshold: 0.3 });
    statsObserver.observe(statsBar);
  }

  // ==========================================================================
  // ACTIVE NAV LINK ON SCROLL
  // ==========================================================================
  const sections = document.querySelectorAll('section[id]');
  
  const activateNavLink = () => {
    const scrollY = window.pageYOffset;

    sections.forEach(current => {
      const sectionHeight = current.offsetHeight;
      const sectionTop = current.offsetTop - 150; // offset for nav height
      const sectionId = current.getAttribute('id');
      const activeLink = document.querySelector(`.nav-menu a[href*=${sectionId}]`);

      if (activeLink) {
        if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
          activeLink.classList.add('active-link');
          // Update colors based on header state
          activeLink.style.color = 'var(--accent-color)';
        } else {
          activeLink.classList.remove('active-link');
          activeLink.style.color = '';
        }
      }
    });
  };

  window.addEventListener('scroll', activateNavLink);
});
