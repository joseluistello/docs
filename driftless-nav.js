(function () {
  var css = [
    '.driftless-logo-link{display:inline-flex!important;align-items:center!important;gap:.55rem!important;text-decoration:none!important}',
    '.driftless-logo-link img{width:1.6rem!important;height:1.6rem!important;object-fit:contain!important}',
    '.driftless-wordmark{color:#1b1a16!important;font-family:"Geist Mono",ui-monospace,monospace!important;font-size:.95rem!important;font-weight:600!important;line-height:1!important;letter-spacing:.02em!important;text-transform:uppercase!important;white-space:nowrap!important}',
    'html.dark .driftless-wordmark,.dark .driftless-wordmark{color:#f0f1ec!important}',
    'nav-tabs{justify-content:center!important}',
    'nav-tabs-item{padding:0 .85rem!important}',
    '@media(min-width:1024px){header>div,header>div>div{max-width:1200px!important;margin-left:auto!important;margin-right:auto!important}}'
  ].join('\n')

  function injectStyle() {
    if (document.getElementById('driftless-nav-style')) return
    var style = document.createElement('style')
    style.id = 'driftless-nav-style'
    style.textContent = css
    document.head.appendChild(style)
  }

  function applyBrand() {
    var logo = document.querySelector('nav-logo, header a[href*="driftless.icu"], header a[href="/"]')
    if (!logo || logo.querySelector('.driftless-wordmark')) return

    logo.classList.add('driftless-logo-link')

    var span = document.createElement('span')
    span.className = 'driftless-wordmark'
    span.textContent = 'driftless'
    logo.appendChild(span)
  }

  function run() {
    injectStyle()
    applyBrand()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run)
  } else {
    run()
  }

  new MutationObserver(run).observe(document.documentElement, { childList: true, subtree: true })
})()
