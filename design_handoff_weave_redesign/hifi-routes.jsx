// hifi-routes.jsx — Routes editor (inline expanded from a ConnectionCard)

function RouteRow({route, onRemove, onChange}) {
  const r = route;
  const empty = !r.intent;
  return <div className={`flex items-center gap-2 rounded-lg border p-2 ${empty?'border-dashed border-zinc-300 dark:border-white/10':'border-zinc-950/5 bg-white dark:border-white/10 dark:bg-zinc-900'}`}>
    <button className="cursor-grab text-zinc-300 hover:text-zinc-500 dark:text-zinc-600"><Glyph name="drag" size={14}/></button>
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {/* Input select */}
      <div className="flex items-center gap-1.5 rounded-md border border-zinc-950/10 bg-white px-2 py-1 text-xs font-mono dark:border-white/10 dark:bg-zinc-900">
        <Glyph name={inputGlyph(r.input)} size={12}/>
        <span className="text-zinc-900 dark:text-zinc-100">{r.input}</span>
        <Glyph name="chevron_d" size={10} className="text-zinc-400"/>
      </div>
      <Glyph name="chevron_r" size={14} className="shrink-0 text-zinc-400"/>
      {/* Intent select */}
      {empty
        ? <button className="text-xs text-blue-600 hover:underline dark:text-blue-400">+ pick intent…</button>
        : <div className="flex items-center gap-1 rounded-md border border-zinc-950/10 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-zinc-900">
            <span className="text-zinc-900 dark:text-zinc-100">{r.intent}</span>
            <Glyph name="chevron_d" size={10} className="text-zinc-400"/>
          </div>}
      {/* Params */}
      {r.params?.damping!=null && <div className="flex items-center gap-1 rounded-md bg-zinc-50 px-2 py-1 font-mono text-[11px] text-zinc-600 dark:bg-white/5 dark:text-zinc-400">
        damping <span className="font-semibold text-zinc-900 dark:text-zinc-100">{r.params.damping}</span>
      </div>}
    </div>
    <button onClick={onRemove} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-white/10"><Glyph name="close" size={12}/></button>
  </div>;
}

function RoutesEditor({mapping}) {
  const m = mapping;
  const device = findDevice(m.device_id);
  const tLabel = targetLabelFor(m.service_type, m.service_target);
  const unusedGestures = INPUT_TYPES.filter(g => !m.routes.some(r=>r.input===g)).slice(0,3);

  return <div className="mx-auto max-w-[880px] rounded-2xl border border-zinc-950/5 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
    {/* Header */}
    <div className="flex items-center gap-3 border-b border-zinc-950/5 px-5 py-3 dark:border-white/10">
      <div className="flex items-center gap-2 text-[15px] font-semibold text-zinc-950 dark:text-white">
        <span>{device?.nickname}</span>
        <Glyph name="chevron_r" size={14} className="text-zinc-400"/>
        <Glyph name={m.service_type==='roon'?'play':'bulb'} size={14} className="text-zinc-500"/>
        <span>{tLabel}</span>
      </div>
      <Badge color={m.active?'green':'zinc'}>{m.active?'active':'inactive'}</Badge>
      <div className="ml-auto flex items-center gap-2">
        <Button plain size="sm">Duplicate</Button>
        <Button outline size="sm">Cancel</Button>
        <Button color="blue" size="sm">Save</Button>
      </div>
    </div>

    <div className="grid grid-cols-[1fr_260px] gap-6 p-5">
      <div className="flex flex-col gap-4">
        {/* Preset chips */}
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Preset</h3>
            <span className="font-mono text-[11px] text-zinc-400">start with a template, or skip</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-full border border-blue-500 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              <Glyph name="check" size={10} className="mr-1 inline"/>Music default
            </button>
            <button className="rounded-full border border-zinc-950/10 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-950/15 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300">Discovery (+ zone switch)</button>
            <button className="rounded-full border border-zinc-950/10 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-950/15 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300">Single button</button>
            <button className="rounded-full border border-dashed border-zinc-950/15 bg-white px-3 py-1 text-xs font-medium text-zinc-500 dark:border-white/15 dark:bg-zinc-900 dark:text-zinc-400">Custom</button>
          </div>
        </section>

        {/* Routes */}
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Routes <span className="ml-1 font-normal text-zinc-400">{m.routes.length}</span></h3>
            <span className="font-mono text-[11px] text-zinc-400">↑↓ reorder · first match wins</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {m.routes.map((r,i) => <RouteRow key={i} route={r}/>)}
            {/* empty suggestions */}
            {unusedGestures.map(g => <div key={g} className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 p-2 text-xs opacity-70 dark:border-white/10">
              <Glyph name="drag" size={14} className="text-zinc-300 dark:text-zinc-700"/>
              <div className="flex items-center gap-1.5 rounded-md border border-zinc-950/5 bg-zinc-50 px-2 py-1 font-mono text-xs text-zinc-500 dark:border-white/5 dark:bg-white/5 dark:text-zinc-500">
                <Glyph name={inputGlyph(g)} size={12}/>{g}
              </div>
              <Glyph name="chevron_r" size={14} className="text-zinc-300"/>
              <button className="text-xs text-blue-600 hover:underline dark:text-blue-400">+ assign intent</button>
            </div>)}
          </div>
          <button className="mt-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5">
            <Glyph name="plus" size={12}/>Add route
          </button>
        </section>

        {/* Target switch */}
        <section className="rounded-lg border border-zinc-950/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/5">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Target switching <span className="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">advanced</span></h3>
              <p className="mt-0.5 text-[11px] text-zinc-500">Let a gesture cycle between multiple targets (e.g. swipe_up → switch zone)</p>
            </div>
            <div className="relative inline-flex h-5 w-9 items-center rounded-full bg-blue-600 transition">
              <span className="ml-4 inline-block h-4 w-4 rounded-full bg-white shadow transition"/>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-600 dark:text-zinc-400">On</span>
            <GestureChip input="swipe_up"/>
            <span className="text-xs text-zinc-600 dark:text-zinc-400">cycle:</span>
            <Badge color="blue">Living</Badge>
            <Glyph name="chevron_r" size={10} className="text-zinc-400"/>
            <Badge color="zinc">Kitchen</Badge>
            <button className="text-xs text-blue-600 hover:underline dark:text-blue-400">+ add target</button>
          </div>
        </section>
      </div>

      {/* Right rail: Preview & Feedback mini */}
      <aside className="flex flex-col gap-4">
        <section className="rounded-lg border border-zinc-950/5 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Device preview</h3>
          <div className="flex flex-col items-center gap-2 py-2">
            <NuimoViz pattern="vol_mid" size={96} firing/>
            <div className="font-mono text-[11px] text-zinc-500">{device?.nickname} · live mirror</div>
          </div>
          <Button color="orange" size="sm" className="w-full">
            <Glyph name="zap" size={12}/>Try it now
          </Button>
        </section>
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Feedback</h3>
          <div className="flex flex-col gap-1.5">
            {m.feedback.map((f,i) => <div key={i} className="flex items-center gap-2 rounded-md border border-zinc-950/5 bg-white px-2.5 py-1.5 text-xs dark:border-white/10 dark:bg-zinc-900">
              <span className="font-mono text-zinc-500">{f.state}</span>
              <Glyph name="chevron_r" size={10} className="text-zinc-400"/>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{f.feedback_type}</span>
            </div>)}
            <button className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5">
              <Glyph name="plus" size={12}/>Add feedback
            </button>
          </div>
        </section>
      </aside>
    </div>
  </div>;
}

Object.assign(window, {RoutesEditor, RouteRow});
