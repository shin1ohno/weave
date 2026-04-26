// hifi-main.jsx — A2 main view (3-pane) with Catalyst styles

function TopBar({dark, setDark, connected=true, firingCount=1}) {
  return <header className="flex h-14 items-center gap-4 border-b border-zinc-950/5 bg-white px-6 dark:border-white/10 dark:bg-zinc-950">
    <div className="flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
        <Glyph name="zap" size={14}/>
      </div>
      <span className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-white">weave</span>
    </div>
    <div className="relative ml-4 w-72">
      <Glyph name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/>
      <input placeholder="Search devices, services, mappings…"
        className="w-full rounded-lg border border-zinc-950/10 bg-white py-1.5 pl-9 pr-16 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white"/>
      <Kbd className="absolute right-2 top-1/2 -translate-y-1/2">⌘K</Kbd>
    </div>
    <div className="ml-auto flex items-center gap-3">
      {firingCount>0 && <Badge color="orange"><LiveDot color="orange" firing/> {firingCount} firing</Badge>}
      <Badge color={connected?'green':'zinc'}><LiveDot color={connected?'green':'zinc'}/> {connected?'live':'offline'}</Badge>
      <Button plain size="sm" onClick={()=>setDark(!dark)} aria-label="Toggle theme">
        <Glyph name={dark?'sun':'moon'} size={16}/>
      </Button>
      <div className="h-6 w-px bg-zinc-950/10 dark:bg-white/10"/>
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">S</div>
    </div>
  </header>;
}

function DeviceTile({device, selected, onClick}) {
  const d = device;
  const battColor = d.battery==null ? 'zinc' : d.battery<30 ? 'red' : d.battery<60 ? 'amber' : 'green';
  return <div onClick={onClick} className={`group relative cursor-pointer rounded-xl border bg-white p-4 shadow-sm transition dark:bg-zinc-900 ${selected?'border-blue-500 ring-2 ring-blue-500/30':'border-zinc-950/5 hover:border-zinc-950/10 dark:border-white/10 dark:hover:border-white/15'} ${!d.connected?'opacity-60':''}`}>
    <div className="flex items-start gap-3">
      <NuimoViz pattern={d.led} size={56} firing={d.connected && d.lastInput?.at==='now'}/>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div className="truncate text-base font-semibold text-zinc-950 dark:text-white">{d.nickname}</div>
          {d.connected && d.lastInput?.at==='now' && <LiveDot color="orange" firing/>}
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{d.device_type} · {d.device_id.slice(-8)}</div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {d.connected ? <Badge color={battColor}><Glyph name="battery" size={10}/>{d.battery}%</Badge>
                       : <Badge color="zinc"><Glyph name="wifi_off" size={10}/>offline</Badge>}
          <Badge color="zinc"><Glyph name="link" size={10}/>{d.connectionsCount}</Badge>
        </div>
        {d.connected && d.lastInput && <div className="mt-2 truncate font-mono text-[11px] text-zinc-500 dark:text-zinc-500">
          {d.lastInput.at} · {d.lastInput.input}{d.lastInput.value?' '+d.lastInput.value:''}
        </div>}
      </div>
    </div>
  </div>;
}

function ServiceTargetRow({target, onClick, active}) {
  const st = target.state || {};
  const statusChip = st.playback==='playing' ? <Badge color="green"><Glyph name="play" size={10}/>playing</Badge>
    : st.playback==='idle' ? <Badge color="zinc">idle</Badge>
    : st.on===true ? <Badge color="amber">on · {st.brightness}%</Badge>
    : st.on===false ? <Badge color="zinc">off</Badge> : null;
  return <div onClick={onClick} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${active?'bg-blue-50 dark:bg-blue-500/10':'hover:bg-zinc-50 dark:hover:bg-white/5'}`}>
    <div className="min-w-0 flex-1">
      <div className="truncate font-medium text-zinc-900 dark:text-zinc-100">{target.label}</div>
      {st.track && <div className="truncate font-mono text-[11px] text-zinc-500">{st.track}</div>}
    </div>
    {statusChip}
    {target.linkedCount>0 && <Badge color="zinc">{target.linkedCount}↔</Badge>}
  </div>;
}

function ServiceCard({service, onPickTarget, activeTargetId}) {
  return <div className="rounded-xl border border-zinc-950/5 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-zinc-900">
    <div className="flex items-center gap-2 px-1 pb-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
        <Glyph name={service.type==='roon'?'play':'bulb'} size={14}/>
      </div>
      <div className="flex-1 text-base font-semibold text-zinc-950 dark:text-white">{service.label}</div>
      <Badge color="green"><LiveDot color="green"/>{service.status}</Badge>
    </div>
    <div className="flex flex-col gap-0.5">
      {service.targets.map(t => <ServiceTargetRow key={t.id} target={t} active={t.id===activeTargetId} onClick={()=>onPickTarget?.(service.type, t.id)}/>)}
    </div>
  </div>;
}

function GestureChip({input}) {
  return <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-700 dark:bg-white/5 dark:text-zinc-300">
    <Glyph name={inputGlyph(input)} size={10}/>{input}
  </span>;
}
// ConnectionCard is imported from hifi-connection.jsx

function WeaveMainView({dark, setDark}) {
  const [selectedDevice, setSelectedDevice] = React.useState(DEMO_DEVICES[0].device_id);
  const [filter, setFilter] = React.useState('all');
  const filtered = DEMO_MAPPINGS.filter(m => {
    if (!selectedDevice) return true;
    return m.device_id === selectedDevice;
  }).filter(m => filter==='all' || (filter==='active' && m.active) || (filter==='firing' && m.firing));

  return <div className="flex h-full flex-col">
    <TopBar dark={dark} setDark={setDark} firingCount={DEMO_MAPPINGS.filter(x=>x.firing).length}/>
    <div className="grid flex-1 grid-cols-[320px_1fr_320px] gap-6 overflow-hidden bg-zinc-50 p-6 dark:bg-zinc-950">
      {/* Devices */}
      <aside className="flex min-h-0 flex-col gap-3 overflow-hidden">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Devices</h2>
            <Badge color="zinc">{DEMO_DEVICES.length}</Badge>
          </div>
          <Button plain size="sm"><Glyph name="plus" size={14}/>Pair</Button>
        </div>
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto pr-1">
          {DEMO_DEVICES.map(d => <DeviceTile key={d.device_id} device={d} selected={d.device_id===selectedDevice} onClick={()=>setSelectedDevice(d.device_id===selectedDevice?null:d.device_id)}/>)}
        </div>
      </aside>

      {/* Connections */}
      <main className="flex min-h-0 flex-col gap-3 overflow-hidden">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Connections</h2>
            <Badge color="zinc">{filtered.length}</Badge>
            {selectedDevice && <Badge color="blue">
              for {findDevice(selectedDevice)?.nickname}
              <button onClick={()=>setSelectedDevice(null)} className="ml-0.5 opacity-60 hover:opacity-100"><Glyph name="close" size={10}/></button>
            </Badge>}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-zinc-950/10 bg-white p-0.5 text-xs dark:border-white/10 dark:bg-zinc-900">
            {['all','active','firing'].map(f => <button key={f} onClick={()=>setFilter(f)} className={`rounded px-2 py-0.5 font-medium capitalize transition ${filter===f?'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900':'text-zinc-600 dark:text-zinc-400'}`}>{f}</button>)}
          </div>
        </div>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
          {filtered.map(m => <ConnectionCard key={m.mapping_id} mapping={m} device={findDevice(m.device_id)} serviceLabel={targetLabelFor(m.service_type, m.service_target)}/>)}
          <button className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 py-5 text-sm font-medium text-zinc-500 transition hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600 dark:border-white/15 dark:text-zinc-400 dark:hover:border-blue-500 dark:hover:bg-blue-500/5 dark:hover:text-blue-400">
            <Glyph name="plus" size={16}/>
            New connection{selectedDevice?` from ${findDevice(selectedDevice)?.nickname}`:''}
          </button>
          <p className="text-center font-mono text-[11px] text-zinc-400">or drag a Device tile onto a Service target</p>
        </div>
      </main>

      {/* Services */}
      <aside className="flex min-h-0 flex-col gap-3 overflow-hidden">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Services</h2>
            <Badge color="zinc">{DEMO_SERVICES.length}</Badge>
          </div>
          <Button plain size="sm"><Glyph name="plus" size={14}/>Add</Button>
        </div>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
          {DEMO_SERVICES.map(s => <ServiceCard key={s.type} service={s}/>)}
        </div>
      </aside>
    </div>
  </div>;
}

Object.assign(window, {WeaveMainView, ConnectionCard, DeviceTile, ServiceCard, TopBar, GestureChip});
