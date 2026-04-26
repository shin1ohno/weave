// hifi-connection.jsx — Central Connection cards for A2 main view

const INPUT_SHORT = {
  rotate:'rotate', press:'press', release:'release', long_press:'long press',
  swipe_up:'swipe ↑', swipe_down:'swipe ↓', swipe_left:'swipe ←', swipe_right:'swipe →',
  slide:'slide', hover:'hover',
  touch_top:'touch ↑', touch_bottom:'touch ↓', touch_left:'touch ←', touch_right:'touch →',
  key_press:'key',
};
const INTENT_SHORT = {
  volume_change:'volume', volume_set:'volume=', brightness_change:'brightness', brightness_set:'brightness=',
  play_pause:'play/pause', seek_relative:'seek', seek_absolute:'seek=',
  power_toggle:'toggle power', power_on:'power on', power_off:'power off',
};
const prettyInput = (i) => INPUT_SHORT[i] || i;
const prettyIntent = (i) => INTENT_SHORT[i] || i;

function RoutePill({route, mini=false}) {
  return <span className={`inline-flex items-center gap-1 rounded-md border border-zinc-950/10 bg-zinc-50 py-0.5 dark:border-white/10 dark:bg-zinc-900 ${mini?'px-1.5 text-[10px]':'px-2 text-xs'}`}>
    <Glyph name={{rotate:'rotate',press:'press',release:'press',long_press:'long',
      swipe_up:'swipe_u',swipe_down:'swipe_d',swipe_left:'swipe_l',swipe_right:'swipe_r',
      slide:'rotate',hover:'press',key_press:'press',
      touch_top:'swipe_u',touch_bottom:'swipe_d',touch_left:'swipe_l',touch_right:'swipe_r'}[route.input] || 'press'} size={mini?10:12} className="text-zinc-500"/>
    <span className="font-medium text-zinc-700 dark:text-zinc-200">{prettyInput(route.input)}</span>
    <span className="text-zinc-400">→</span>
    <span className="text-zinc-900 dark:text-zinc-100">{prettyIntent(route.intent)}</span>
  </span>;
}

function ConnectionCard({mapping, device, serviceLabel, onEdit, onToggleActive, onDelete}) {
  const m = mapping;
  const firing = m.firing;
  return <div className={`group relative rounded-xl border bg-white p-4 transition dark:bg-zinc-900 ${
    firing ? 'border-orange-500/60 ring-2 ring-orange-500/30 shadow-sm'
    : m.active ? 'border-zinc-950/10 shadow-sm hover:border-zinc-950/20 dark:border-white/10 dark:hover:border-white/20'
    : 'border-dashed border-zinc-950/10 bg-zinc-50/40 dark:border-white/10 dark:bg-zinc-950/60'
  }`}>
    {firing && <div className="absolute -top-2.5 right-3">
      <Badge color="orange"><LiveDot color="orange" firing/>firing · just now</Badge>
    </div>}

    <div className="flex items-start gap-3">
      {/* device side */}
      <div className="flex min-w-0 items-center gap-2">
        <NuimoViz pattern={device?.led||device?.led_pattern||'blank'} size={40} firing={firing}/>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-950 dark:text-white">{device?.nickname || m.device_id.slice(-6)}</div>
          <div className="font-mono text-[10px] text-zinc-400">{m.device_type}</div>
        </div>
      </div>

      {/* connector */}
      <div className="mt-4 flex flex-1 items-center gap-2">
        <div className={`h-0.5 flex-1 ${firing?'bg-orange-400':m.active?'bg-zinc-300 dark:bg-zinc-700':'bg-zinc-200 border-t border-dashed dark:bg-transparent dark:border-zinc-700'}`}/>
        <Glyph name="chevron_r" size={14} className={firing?'text-orange-500':'text-zinc-400'}/>
        <div className={`h-0.5 flex-1 ${firing?'bg-orange-400':m.active?'bg-zinc-300 dark:bg-zinc-700':'bg-zinc-200 border-t border-dashed dark:bg-transparent dark:border-zinc-700'}`}/>
      </div>

      {/* service side */}
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-white/5 dark:text-zinc-300">
          <Glyph name={m.service_type==='roon'?'play':'bulb'} size={18}/>
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-zinc-950 dark:text-white">{serviceLabel}</div>
          <div className="font-mono text-[10px] text-zinc-400">{m.service_type}</div>
        </div>
      </div>

      <div className="ml-2 mt-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
        <button onClick={onEdit} className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/5" title="Edit">
          <Glyph name="edit" size={14}/>
        </button>
        <button onClick={onDelete} className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10" title="Delete">
          <Glyph name="close" size={14}/>
        </button>
      </div>
    </div>

    {/* routes */}
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {m.routes.map((r,i) => <RoutePill key={i} route={r}/>)}
      <button onClick={onEdit} className="inline-flex items-center gap-1 rounded-md border border-dashed border-zinc-300 px-2 py-0.5 text-xs text-zinc-500 hover:border-blue-500 hover:text-blue-600 dark:border-zinc-700 dark:text-zinc-400">
        <Glyph name="plus" size={10}/> route
      </button>
    </div>

    {/* feedback & target-switch meta */}
    {(m.feedback?.length>0 || m.target_switch_on || m.target_candidates?.length>0) && (
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-100 pt-2 text-xs text-zinc-500 dark:border-white/5">
        {m.feedback?.length>0 && <span className="inline-flex items-center gap-1">
          <Glyph name="link" size={11} className="text-zinc-400"/>
          Feedback: {m.feedback.map(f=>f.state).join(', ')}
        </span>}
        {m.target_switch_on && <span className="inline-flex items-center gap-1">
          <Glyph name={{swipe_up:'swipe_u',swipe_down:'swipe_d'}[m.target_switch_on] || 'swipe_r'} size={11} className="text-zinc-400"/>
          Switch target on <span className="font-mono">{m.target_switch_on}</span> ({m.target_candidates.length} options)
        </span>}
        {!m.active && <span className="ml-auto"><Badge color="zinc">inactive</Badge></span>}
        {m.lastEvent && m.active && <span className="ml-auto font-mono text-[10px]">{m.lastEvent}</span>}
      </div>
    )}
  </div>;
}

Object.assign(window, { ConnectionCard, RoutePill, prettyInput, prettyIntent });
