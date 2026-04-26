// hifi-tryit.jsx — Try-it panel: before-save live verification, plus Input Stream

function ChecklistRow({input, intent, status, value}) {
  const icon = status==='ok' ? 'check' : status==='pending' ? 'dot' : 'dot';
  const colorCls = status==='ok' ? 'text-green-600 bg-green-50 dark:bg-green-500/10 dark:text-green-400'
    : status==='pending' ? 'text-zinc-400 bg-zinc-50 dark:bg-white/5 dark:text-zinc-500'
    : 'text-orange-600 bg-orange-50 dark:bg-orange-500/10 dark:text-orange-400';
  return <div className="flex items-center gap-3 rounded-lg border border-zinc-950/5 bg-white px-3 py-2 dark:border-white/10 dark:bg-zinc-900">
    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${colorCls}`}>
      <Glyph name={icon} size={12}/>
    </div>
    <GestureChip input={input}/>
    <Glyph name="chevron_r" size={12} className="text-zinc-400"/>
    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{intent || <span className="italic text-zinc-400">(unassigned)</span>}</span>
    {value && <span className="ml-auto font-mono text-[11px] text-zinc-500">{value}</span>}
    {status==='ok' && <Badge color="green">✓ verified</Badge>}
    {status==='pending' && <span className="ml-auto text-[11px] text-zinc-400">not tested yet</span>}
  </div>;
}

function InputStreamPanel() {
  const events = [
    {t:'17:42:11.320', dev:'sofa', input:'rotate', value:'Δ+3', intent:'volume_change', ok:true},
    {t:'17:42:11.120', dev:'sofa', input:'rotate', value:'Δ+2', intent:'volume_change', ok:true},
    {t:'17:42:06.802', dev:'sofa', input:'press',  value:'',    intent:'play_pause', ok:true},
    {t:'17:41:52.144', dev:'desk', input:'swipe_right', value:'', intent:'next', ok:true},
    {t:'17:41:44.510', dev:'sofa', input:'swipe_up', value:'',  intent:'(target switch → Kitchen)', ok:true},
    {t:'17:41:20.001', dev:'desk', input:'long_press', value:'', intent:'— unassigned —', ok:false},
  ];
  return <div className="rounded-xl border border-zinc-950/5 bg-white dark:border-white/10 dark:bg-zinc-900">
    <div className="flex items-center justify-between border-b border-zinc-950/5 px-4 py-2 dark:border-white/10">
      <div className="flex items-center gap-2">
        <Glyph name="zap" size={14} className="text-orange-500"/>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Input stream</h3>
        <LiveDot color="orange" firing/>
      </div>
      <div className="flex items-center gap-2">
        <Badge color="zinc">all devices</Badge>
        <Button plain size="sm">Pause</Button>
        <Button plain size="sm">Clear</Button>
      </div>
    </div>
    <div className="max-h-[240px] overflow-y-auto p-2 font-mono text-[11px]">
      <table className="w-full">
        <tbody>
          {events.map((e,i) => <tr key={i} className={`${i===0?'animate-pulse':''}`}>
            <td className="whitespace-nowrap px-2 py-1 text-zinc-400">{e.t}</td>
            <td className="whitespace-nowrap px-2 py-1 font-semibold text-zinc-700 dark:text-zinc-300">{e.dev}</td>
            <td className="whitespace-nowrap px-2 py-1 text-blue-700 dark:text-blue-400">{e.input}</td>
            <td className="whitespace-nowrap px-2 py-1 text-zinc-500">{e.value}</td>
            <td className="px-2 py-1 text-zinc-400">→</td>
            <td className={`w-full px-2 py-1 ${e.ok?'text-zinc-700 dark:text-zinc-300':'text-orange-600 dark:text-orange-400'}`}>{e.intent}</td>
            <td className="px-2 py-1">{e.ok ? <Glyph name="check" size={12} className="text-green-600"/> : <span className="text-orange-500">!</span>}</td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </div>;
}

function TryItPanel({mapping}) {
  const m = mapping || DEMO_MAPPINGS[0];
  const device = findDevice(m.device_id);
  const tgt = findTarget(m.service_type, m.service_target);
  const states = [
    {input:'rotate', intent:'volume_change', status:'ok', value:'52→55'},
    {input:'press', intent:'play_pause', status:'ok', value:'paused→playing'},
    {input:'swipe_right', intent:'next', status:'ok', value:'track +1'},
    {input:'swipe_left', intent:'previous', status:'warn', value:'waiting for gesture'},
    {input:'long_press', intent:null, status:'pending'},
  ];
  const okCount = states.filter(s=>s.status==='ok').length;
  return <div className="flex flex-col gap-4">
    <div className="grid grid-cols-[300px_1fr] gap-4">
      {/* Left: LED mirror + device state */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-950/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Nuimo mirror</h3>
          <Badge color="green"><LiveDot color="green" firing/>linked</Badge>
        </div>
        <div className="flex flex-col items-center gap-3 py-4">
          <NuimoViz pattern="vol_mid" size={160} firing/>
          <div className="text-center">
            <div className="font-mono text-[11px] uppercase tracking-wide text-zinc-500">LED pattern</div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">volume_bar · 55/100</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 border-t border-zinc-950/5 pt-3 dark:border-white/10">
          <div><div className="text-[10px] uppercase text-zinc-400">Battery</div><div className="text-sm font-semibold">{device?.battery}%</div></div>
          <div><div className="text-[10px] uppercase text-zinc-400">Edge</div><div className="truncate font-mono text-xs">{m.edge_id}</div></div>
          <div><div className="text-[10px] uppercase text-zinc-400">Latency</div><div className="text-sm font-semibold text-green-600">2 ms</div></div>
        </div>
      </div>

      {/* Right: gesture checklist */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-950/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Try each gesture</h3>
            <p className="text-[11px] text-zinc-500">Touch the Nuimo to verify before saving. {okCount}/{states.length} verified.</p>
          </div>
          <div className="flex gap-2">
            <Button plain size="sm">Skip all</Button>
            <Button color="blue" size="sm"><Glyph name="check" size={12}/>Save mapping</Button>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-white/5">
          <div className="h-full rounded-full bg-green-500 transition-all" style={{width:`${(okCount/states.length)*100}%`}}/>
        </div>
        <div className="flex flex-col gap-2">
          {states.map((s,i) => <ChecklistRow key={i} {...s}/>)}
        </div>
        {/* Target-side preview */}
        <div className="mt-2 rounded-lg border border-dashed border-zinc-950/10 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/5">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            <Glyph name={m.service_type==='roon'?'play':'bulb'} size={12}/>
            Service state · {m.service_type}/{tgt?.label}
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div><span className="text-zinc-500">playback</span> <span className="font-semibold">{tgt?.state?.playback || '—'}</span></div>
            <div><span className="text-zinc-500">volume</span> <span className="font-semibold">{tgt?.state?.volume ?? '—'}</span></div>
            {tgt?.state?.track && <div className="truncate text-zinc-700 dark:text-zinc-300">{tgt.state.track}</div>}
          </div>
        </div>
      </div>
    </div>
    <InputStreamPanel/>
  </div>;
}

Object.assign(window, {TryItPanel, InputStreamPanel, ChecklistRow});
