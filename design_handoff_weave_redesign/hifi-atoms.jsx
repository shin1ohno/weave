// hifi-atoms.jsx — Catalyst-styled atoms (Tailwind-only, no React imports needed since React is global)

// ---------- Glyph — inline SVG icons ----------
function Glyph({name, size=16, className=''}) {
  const s = size;
  const common = { width:s, height:s, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:1.75, strokeLinecap:'round', strokeLinejoin:'round', className };
  const p = {
    rotate: <><path d="M21 12a9 9 0 1 1-3.5-7.1"/><path d="M21 3v6h-6"/></>,
    press: <circle cx="12" cy="12" r="5"/>,
    long: <><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="9" strokeDasharray="2 2"/></>,
    swipe_l: <><path d="M19 12H6"/><path d="M10 6l-4 6 4 6"/></>,
    swipe_r: <><path d="M5 12h13"/><path d="M14 6l4 6-4 6"/></>,
    swipe_u: <><path d="M12 19V6"/><path d="M6 10l6-4 6 4"/></>,
    swipe_d: <><path d="M12 5v13"/><path d="M6 14l6 4 6-4"/></>,
    play: <path d="M8 5l12 7-12 7z"/>,
    pause: <><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></>,
    bulb: <><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c1 1 1.5 2 1.5 3.5h5c0-1.5.5-2.5 1.5-3.5A6 6 0 0 0 12 3z"/></>,
    vol: <><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6"/></>,
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>,
    chevron_d: <path d="M6 9l6 6 6-6"/>,
    chevron_r: <path d="M9 6l6 6-6 6"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M5 12H3M21 12h-2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></>,
    moon: <path d="M21 13.5A9 9 0 1 1 10.5 3a7 7 0 0 0 10.5 10.5z"/>,
    battery: <><rect x="3" y="8" width="16" height="8" rx="1.5"/><path d="M21 11v2"/></>,
    dot: <circle cx="12" cy="12" r="4"/>,
    zap: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>,
    drag: <><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></>,
    close: <><path d="M6 6l12 12"/><path d="M18 6L6 18"/></>,
    link: <><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></>,
    gear: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2L10 21h4l.6-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/></>,
    command: <><path d="M6 6a2 2 0 1 1 4 0v12a2 2 0 1 1-4 0 2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 1 1-2-2"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></>,
    check: <path d="M5 12l5 5L20 7"/>,
    dot_sm: <circle cx="12" cy="12" r="3" fill="currentColor"/>,
    wifi_off: <><path d="M2 8.8a16 16 0 0 1 20 0"/><path d="M5 12.8a11 11 0 0 1 14 0"/><path d="M8.5 16.4a6 6 0 0 1 7 0"/><path d="M12 20h.01"/><path d="M3 3l18 18"/></>,
  };
  return <svg {...common}>{p[name] || <circle cx="12" cy="12" r="5"/>}</svg>;
}

// ---------- Badge (Catalyst) ----------
const BADGE_COLORS = {
  zinc: 'bg-zinc-600/10 text-zinc-700 group-data-[hover]:bg-zinc-600/20 dark:bg-white/5 dark:text-zinc-400 dark:group-data-[hover]:bg-white/10',
  green: 'bg-green-500/15 text-green-700 group-data-[hover]:bg-green-500/25 dark:bg-green-500/10 dark:text-green-400 dark:group-data-[hover]:bg-green-500/20',
  orange: 'bg-orange-500/15 text-orange-700 group-data-[hover]:bg-orange-500/25 dark:bg-orange-500/10 dark:text-orange-400 dark:group-data-[hover]:bg-orange-500/20',
  blue: 'bg-blue-500/15 text-blue-700 group-data-[hover]:bg-blue-500/25 dark:text-blue-400 dark:bg-blue-500/10 dark:group-data-[hover]:bg-blue-500/20',
  red: 'bg-red-500/15 text-red-700 group-data-[hover]:bg-red-500/25 dark:bg-red-500/10 dark:text-red-400 dark:group-data-[hover]:bg-red-500/20',
  amber: 'bg-amber-400/20 text-amber-700 group-data-[hover]:bg-amber-400/30 dark:bg-amber-400/10 dark:text-amber-400 dark:group-data-[hover]:bg-amber-400/15',
  purple: 'bg-purple-500/15 text-purple-700 group-data-[hover]:bg-purple-500/25 dark:bg-purple-500/10 dark:text-purple-400 dark:group-data-[hover]:bg-purple-500/20',
  rose: 'bg-rose-500/15 text-rose-700 group-data-[hover]:bg-rose-500/25 dark:bg-rose-500/10 dark:text-rose-400 dark:group-data-[hover]:bg-rose-500/20',
};
function Badge({color='zinc', children, className=''}) {
  return <span className={`inline-flex items-center gap-x-1 rounded-md px-1.5 py-0.5 text-xs/5 font-medium sm:text-xs/5 forced-colors:outline ${BADGE_COLORS[color]||BADGE_COLORS.zinc} ${className}`}>{children}</span>;
}

// ---------- Button (subset of Catalyst) ----------
function Button({color='zinc', plain=false, outline=false, size='md', children, className='', ...rest}) {
  const base = 'relative inline-flex items-center justify-center gap-x-2 rounded-lg border text-base/6 font-semibold focus:outline-none data-[focus]:outline-2 data-[focus]:outline-offset-2 data-[focus]:outline-blue-500 data-[disabled]:opacity-50 transition-colors';
  const sizes = { sm:'px-2.5 py-1 text-sm/5', md:'px-3.5 py-[calc(--spacing(2)-1px)] text-sm/6', lg:'px-4 py-2 text-sm/6' };
  let variant;
  if (plain) {
    variant = 'border-transparent text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/5';
  } else if (outline) {
    variant = 'border-zinc-950/10 bg-transparent text-zinc-950 hover:bg-zinc-50 dark:border-white/15 dark:text-white dark:hover:bg-white/5';
  } else {
    const filled = {
      dark: 'border-transparent bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-700 dark:hover:bg-zinc-600',
      zinc: 'border-transparent bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15',
      blue: 'border-transparent bg-blue-600 text-white hover:bg-blue-500 shadow-sm',
      orange: 'border-transparent bg-orange-600 text-white hover:bg-orange-500 shadow-sm',
      green: 'border-transparent bg-green-600 text-white hover:bg-green-500 shadow-sm',
      red: 'border-transparent bg-red-600 text-white hover:bg-red-500',
    };
    variant = filled[color] || filled.zinc;
  }
  return <button {...rest} className={`${base} ${sizes[size]||sizes.md} ${variant} ${className}`}>{children}</button>;
}

// ---------- NuimoViz — 8x8 LED dot matrix mini visualization ----------
// pattern: 'vol_mid' | 'play' | 'pause' | 'blank' | 'brightness'
function NuimoViz({pattern='blank', size=56, firing=false}) {
  const cells = [];
  const dim = 8;
  const fill = (x,y) => true;
  const patterns = {
    vol_mid: (x,y) => (y>=3 && y<=4 && x<=5) || (y===2 && x===4) || (y===5 && x===4) || (y===3 && x===6),
    play: (x,y) => {
      // triangle
      const cx=3.2, cy=3.5; const dx=x-cx, dy=y-cy;
      return dx>=0 && dx<=3 && Math.abs(dy)<=dx*0.9;
    },
    pause: (x,y) => (x===2 || x===5) && y>=1 && y<=6,
    brightness: (x,y) => {
      // sun: center + rays
      if (x>=3 && x<=4 && y>=3 && y<=4) return true;
      if ((x===1||x===6) && y===3.5) return true;
      if ((x===3.5) && (y===1||y===6)) return true;
      return false;
    },
    blank: () => false,
  };
  const fn = patterns[pattern] || patterns.blank;
  for (let y=0; y<dim; y++) for (let x=0; x<dim; x++) cells.push([x, y, fn(x, y)]);
  const cellSize = (size-10)/dim;
  return <div className={`relative inline-flex items-center justify-center rounded-2xl bg-zinc-900 p-[5px] shadow-inner ${firing?'firing-ring':''}`} style={{width:size, height:size}}>
    <div className="grid gap-[1px]" style={{gridTemplateColumns:`repeat(${dim}, ${cellSize}px)`}}>
      {cells.map(([x,y,on], i) => <div key={i} className={`led-cell ${on?'on':''}`} style={{width:cellSize, height:cellSize}}/>)}
    </div>
  </div>;
}

// ---------- Pulsing live dot ----------
function LiveDot({color='green', firing=false}) {
  const c = { green:'bg-green-500', orange:'bg-orange-500', zinc:'bg-zinc-400', red:'bg-red-500' }[color] || 'bg-green-500';
  return <span className={`relative inline-flex h-2 w-2 flex-shrink-0 rounded-full ${c}`}>
    {firing && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${c} opacity-75`}></span>}
  </span>;
}

// ---------- Card shell ----------
function Card({children, className='', onClick, active=false, firing=false}) {
  const base = 'rounded-xl border bg-white shadow-sm dark:bg-zinc-900 transition';
  const activeCls = active ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-zinc-950/5 dark:border-white/10 hover:border-zinc-950/10 dark:hover:border-white/15';
  const firingCls = firing ? 'ring-2 ring-orange-500/40 border-orange-500/60' : '';
  return <div onClick={onClick} className={`${base} ${activeCls} ${firingCls} ${onClick?'cursor-pointer':''} ${className}`}>{children}</div>;
}

// ---------- Kbd ----------
function Kbd({children}) {
  return <kbd className="rounded border border-zinc-950/10 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] text-zinc-600 dark:border-white/15 dark:bg-zinc-800 dark:text-zinc-400">{children}</kbd>;
}

Object.assign(window, { Glyph, Badge, Button, NuimoViz, LiveDot, Card, Kbd });
