// Finishing shared by quick drafts only. Existing custom source stays intact.
export const PAGE_FINISH=`
::selection{background:var(--accent);color:var(--on-accent)}
html{scroll-padding-top:32px}
h1,h2,h3,.art-word{letter-spacing:-.025em;text-wrap:balance}
p{max-width:70ch}
.nav{border-bottom:1px solid var(--line)}
.nav-links{gap:22px;flex-wrap:wrap}
.nav-links a{position:relative;display:inline-flex;align-items:center;min-height:44px;padding:10px 2px;font-size:14px;transition:color .18s ease}
.nav-links a:after{content:'';position:absolute;left:2px;right:2px;bottom:5px;height:2px;background:currentColor;transform:scaleX(0);transform-origin:left;transition:transform .18s ease}
.nav-links a:hover,.nav-links a:focus-visible{color:var(--ink)}
.nav-links a:hover:after,.nav-links a:focus-visible:after{transform:scaleX(1)}
.button{font-size:16px;transition:filter .18s ease,transform .18s ease,box-shadow .18s ease}
.button:hover{filter:brightness(.92);box-shadow:0 8px 22px #00000020;transform:translateY(-1px)}
.button:active{transform:translateY(1px);box-shadow:none}
.button[aria-disabled=true]{opacity:.55;pointer-events:none}
a:focus-visible,summary:focus-visible,video:focus-visible{outline:3px solid var(--ink);outline-offset:5px}
.contact a:focus-visible,footer a:focus-visible{outline-color:#fff}
.text-link{font-size:15px;gap:12px;text-underline-offset:5px;transition:color .18s ease}
.text-link:hover{text-decoration:underline}
.type-art:before{display:none}
.type-art{border-radius:4px;justify-content:space-between}
.art-top{font-size:14px;opacity:1;text-transform:none;letter-spacing:0}
.art-word{line-height:1.04;max-width:10ch;font-weight:600}
.hero-line{font-size:15px;line-height:1.5;padding:17px 0}
.hero-line>span:first-child{display:none}
.offer{border-radius:4px;background:transparent;border-width:1px 0 0}
.offer-body{padding:26px 0}
.offer h3{font-size:26px;line-height:1.2}
.offer p{font-size:16px}
.offer .number{display:none}
.photo-caption,.gallery figcaption{font-size:13px;line-height:1.6}
.technical .hero-visual{border-left:0;padding-left:0}
.preview{font-size:13px;line-height:1.5;padding:10px 20px}
@media(max-width:900px){.nav{flex-wrap:wrap}.nav-links{order:3;width:100%;justify-content:flex-start}.nav .button{margin-left:auto}.nav-links a{font-size:15px}.offer-grid{gap:28px}}
@media(max-width:620px){.nav-links{gap:20px;padding-top:8px;border-top:0;justify-content:flex-start}.brand{max-width:100%}.nav>.button{font-size:13px;max-width:100%;padding:12px 14px}.hero-text>p{line-height:1.7}.hero-location{font-size:14px}.section{padding-top:54px;padding-bottom:54px}.offer-grid{gap:26px}.contact-details p{font-size:16px}.preview{font-size:12px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.nav-links a,.nav-links a:after,.button,.text-link{transition:none}.button:hover,.button:active{transform:none}}
`;
