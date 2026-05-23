(function () {
  var css = [
    'header a[href="https://driftless.icu"]{display:inline-flex!important;align-items:center!important;gap:.625rem!important;min-width:9.5rem!important;text-decoration:none!important}',
    'header a[href="https://driftless.icu"] img{width:2rem!important;height:2rem!important;object-fit:contain!important}',
    'header a[href="/"] svg,header a[href="/concepts/topics"] svg,header a[href="/cli/setup"] svg,header a[href="/api/overview"] svg,header a[href="/security/overview"] svg{display:none!important}',
    'header a[href="/"],header a[href="/concepts/topics"],header a[href="/cli/setup"],header a[href="/api/overview"],header a[href="/security/overview"]{gap:0!important;padding-left:.75rem!important;padding-right:.75rem!important}',
    '@media (min-width:1024px){header>div,header>div>div{max-width:1160px!important;margin-left:auto!important;margin-right:auto!important}}',
    '.driftless-wordmark{color:#f0f1ec!important;font-family:"Geist Mono",monospace!important;font-size:1.02rem!important;font-weight:650!important;line-height:1!important;letter-spacing:0!important;white-space:nowrap!important}'
  ].join('\n')

  function injectStyle() {
    if (document.getElementById('driftless-nav-style')) return
    var style = document.createElement('style')
    style.id = 'driftless-nav-style'
    style.textContent = css
    document.head.appendChild(style)
  }

  function applyBrand() {
    var logo = document.querySelector('header a[href="https://driftless.icu"]')
    if (!logo || logo.querySelector('.driftless-wordmark')) return
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
