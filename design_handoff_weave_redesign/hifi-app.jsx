// hifi-app.jsx — root composition with dark mode + design canvas

function App() {
  const [dark, setDark] = React.useState(() => {
    try { return localStorage.getItem('weave-hifi-dark')==='1'; } catch { return false; }
  });
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try { localStorage.setItem('weave-hifi-dark', dark?'1':'0'); } catch {}
  }, [dark]);

  return <DesignCanvas>
    <DCSection id="main" title="A2 · Main view" subtitle="Devices (left) · Connections (center, main) · Services (right) — 選択中の sofa にフィルタ済み">
      <DCArtboard id="main-light" label="Light mode" width={1440} height={900}>
        <div className="h-[900px] w-[1440px] overflow-hidden rounded-xl bg-zinc-50">
          <div className="h-full w-full">
            <WeaveMainView dark={false} setDark={()=>{}}/>
          </div>
        </div>
      </DCArtboard>
      <DCArtboard id="main-dark" label="Dark mode" width={1440} height={900}>
        <div className="dark h-[900px] w-[1440px] overflow-hidden rounded-xl bg-zinc-950">
          <WeaveMainView dark={true} setDark={()=>{}}/>
        </div>
      </DCArtboard>
    </DCSection>

    <DCSection id="routes" title="Routes editor" subtitle="Connection カードをクリック → この画面が inline で展開される想定 (modal ではない)">
      <DCArtboard id="routes-light" label="Routes editor · light" width={1000} height={820}>
        <div className="h-[820px] w-[1000px] bg-zinc-50 p-8">
          <RoutesEditor mapping={DEMO_MAPPINGS[0]}/>
        </div>
      </DCArtboard>
      <DCArtboard id="routes-dark" label="Routes editor · dark" width={1000} height={820}>
        <div className="dark h-[820px] w-[1000px] bg-zinc-950 p-8">
          <RoutesEditor mapping={DEMO_MAPPINGS[0]}/>
        </div>
      </DCArtboard>
    </DCSection>

    <DCSection id="tryit" title="Try-it panel" subtitle="保存前の実機検証 + Input stream (開発者向け panel は Try it モード時のみ)">
      <DCArtboard id="tryit-light" label="Try it · light" width={1100} height={900}>
        <div className="h-[900px] w-[1100px] bg-zinc-50 p-8">
          <TryItPanel mapping={DEMO_MAPPINGS[0]}/>
        </div>
      </DCArtboard>
      <DCArtboard id="tryit-dark" label="Try it · dark" width={1100} height={900}>
        <div className="dark h-[900px] w-[1100px] bg-zinc-950 p-8">
          <TryItPanel mapping={DEMO_MAPPINGS[0]}/>
        </div>
      </DCArtboard>
    </DCSection>

    <DCSection id="flow" title="UX flow · 6 steps" subtitle="Device → Service → Routes → Try it → Feedback → Live の状態遷移を storyboard で">
      <DCArtboard id="flow-light" label="Flow storyboard · light" width={2180} height={560}>
        <div className="h-[560px] w-[2180px] bg-zinc-50">
          <StoryFlow/>
        </div>
      </DCArtboard>
      <DCArtboard id="flow-dark" label="Flow storyboard · dark" width={2180} height={560}>
        <div className="dark h-[560px] w-[2180px] bg-zinc-950">
          <StoryFlow/>
        </div>
      </DCArtboard>
    </DCSection>

    <DCSection id="theme-toggle" title="Theme" subtitle="global toggle (top-right sun/moon) で light/dark 切替 — localStorage に永続化">
      <DCArtboard id="toggle" label="Global toggle demo" width={520} height={180}>
        <div className="flex h-[180px] w-[520px] flex-col items-center justify-center gap-4 rounded-xl bg-white p-6 dark:bg-zinc-900">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Current theme: <b className="text-zinc-950 dark:text-white">{dark?'dark':'light'}</b></p>
          <Button color={dark?'zinc':'dark'} onClick={()=>setDark(!dark)}>
            <Glyph name={dark?'sun':'moon'} size={16}/>Switch to {dark?'light':'dark'}
          </Button>
        </div>
      </DCArtboard>
    </DCSection>
  </DesignCanvas>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
