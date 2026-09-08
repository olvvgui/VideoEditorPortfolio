import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowUpRight,
  ArrowDown,
  ArrowRight,
  Play,
  Search,
  Menu,
  X,
  Aperture,
  Film,
  AudioLines,
  Plus,
} from "lucide-react";
import { api, type Category, type Video } from "./api";
import { demoVideos } from "../shared/demo";
import { categories as defaultCategories } from "../shared/youtube";
import { VideoModal } from "./components/VideoModal";
import { Admin } from "./components/Admin";
import { ContactDock } from "./components/ContactDock";
export function Logo({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <a
      className={`logo ${className}`}
      style={style}
      href="/"
      aria-label="FRAME, início"
    >
      FRAME<span>®</span>
      <i />
    </a>
  );
}

function AnimatedLogo() {
  const slotRef = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState({ left: 0, top: 0, ready: false });
  const [centered, setCentered] = useState(false);

  useLayoutEffect(() => {
    const updateOrigin = () => {
      const rect = slotRef.current?.getBoundingClientRect();
      if (rect) setOrigin({ left: rect.left, top: rect.top, ready: true });
    };
    updateOrigin();
    window.addEventListener("resize", updateOrigin);
    return () => window.removeEventListener("resize", updateOrigin);
  }, []);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setCentered(!reducedMotion.matches && scrollY > 110);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <div className="animated-logo-slot" ref={slotRef}>
      <Logo
        className={`animated-logo ${centered ? "is-centered" : ""}`}
        style={{
          left: centered ? "50%" : origin.left,
          top: centered ? 14 : origin.top,
          opacity: origin.ready ? undefined : 0,
        }}
      />
    </div>
  );
}
function App() {
  const [videos, setVideos] = useState<Video[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [filter, setFilter] = useState("Todos"),
    [categoryOptions, setCategoryOptions] = useState<string[]>([
      ...defaultCategories,
    ]),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<Video | null>(null),
    [menu, setMenu] = useState(false);
  const [service, setService] = useState<number | null>(null);
  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([api<Video[]>("/videos"), api<Category[]>("/categories")])
      .then(([loadedVideos, loadedCategories]) => {
        setVideos(loadedVideos);
        setCategoryOptions(loadedCategories.map(({ name }) => name));
      })
      .catch(() =>
        setError("Não foi possível carregar os projetos. Tente novamente."),
      )
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);
  if (window.location.pathname.startsWith("/admin")) return <Admin />;
  const filtered = videos.filter(
    (v) =>
      (filter === "Todos" || v.category === filter) &&
      `${v.title} ${v.category} ${v.description}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
  );
  const featured = videos.find(({ isShowreel }) => isShowreel) ?? videos[0];
  const services = [
    {
      icon: Film,
      title: "Edição de vídeo",
      detail:
        "Narrativa, ritmo e intenção em cada corte. Montagem completa para filmes de marca, campanhas e conteúdo digital.",
    },
    {
      icon: Aperture,
      title: "Color grading",
      detail:
        "Cores que contam a sua história. Correção e tratamento de cor para uma identidade visual consistente e cinematográfica.",
    },
    {
      icon: AudioLines,
      title: "Sound design",
      detail:
        "Uma experiência que também se sente. Efeitos, trilha e mixagem para dar profundidade a cada cena.",
    },
  ];
  return (
    <>
      <header className="site-header">
        <div className="container nav-wrap">
          <AnimatedLogo />
          <nav
            className={menu ? "nav-links open" : "nav-links"}
            aria-label="Menu principal"
          >
            <a
              className="active"
              href="#projetos"
              onClick={() => setMenu(false)}
            >
              Projetos
            </a>
            <a href="#sobre" onClick={() => setMenu(false)}>
              Sobre mim
            </a>
            <a href="#servicos" onClick={() => setMenu(false)}>
              Serviços
            </a>
            <a
              className="mobile-contact"
              href="#contato"
              onClick={() => setMenu(false)}
            >
              Vamos conversar <ArrowUpRight size={15} />
            </a>
          </nav>
          <a className="nav-cta" href="#contato">
            Vamos conversar <ArrowUpRight size={16} />
          </a>
          <button
            className="menu-button icon-button"
            aria-label={menu ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main>
        <section className="hero container">
          <div className="hero-copy">
            <div className="availability">
              <span /> DISPONÍVEL PARA NOVOS PROJETOS
            </div>
            <h1>
              Boas histórias
              <br />
              merecem um
              <br />
              <span>grande corte.</span>
              <svg
                className="hero-spark"
                viewBox="0 0 60 60"
                aria-hidden="true"
              >
                <path d="M30 3v54M3 30h54M11 11l38 38M11 49l38-38" />
              </svg>
            </h1>
            <p>
              Transformo imagens em histórias que conectam.
              <br className="desktop-break" /> Edição de vídeo com ritmo,
              intenção e personalidade.
            </p>
            <div className="hero-actions">
              <a className="button button-green" href="#projetos">
                Explore meus projetos <ArrowDown size={17} />
              </a>
              <button
                className="showreel"
                disabled={!featured}
                onClick={() => featured && setSelected(featured)}
              >
                <span className="play-outline">
                  <Play size={12} fill="currentColor" />
                </span>{" "}
                Assista ao showreel
              </button>
            </div>
          </div>
          <div className="hero-visual">
            <div className="film-top">
              <span>
                <i /> UM NOVO OLHAR, A CADA FRAME
              </span>
              <span>
                REC <i className="rec-dot" />
              </span>
            </div>
            <button
              className="hero-film"
              aria-label="Assistir ao projeto em destaque"
              disabled={!featured}
              onClick={() => featured && setSelected(featured)}
            >
              <img
                src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1500&q=90"
                alt="Montanhas envoltas em nuvens sob a luz do sol"
              />
              <span className="viewfinder top-left" />
              <span className="viewfinder top-right" />
              <span className="viewfinder bottom-left" />
              <span className="viewfinder bottom-right" />
              <span className="film-cross">+</span>
              <span className="hero-film-title">
                Vá além.<small>HISTÓRIAS SEM LIMITES.</small>
              </span>
              <span className="hero-play">
                <Play size={20} fill="currentColor" />
              </span>
              <span className="film-bottom">
                <span>DIRECTED BY CURIOSITY</span>
                <span>
                  4K <b>16:9</b>
                </span>
              </span>
            </button>
            <div className="timeline">
              <span>00:00:00:00</span>
              <div className="timeline-track">
                <i />
                <b />
              </div>
              <span>00:02:34:12</span>
            </div>
            <div className="visual-caption">
              <span>EDIÇÃO QUE VOCÊ VÊ. EMOÇÃO QUE VOCÊ SENTE.</span>
              <ArrowUpRight size={18} />
            </div>
          </div>
        </section>
        <div className="specialty-strip">
          <div className="container">
            <span>UM BOM VÍDEO NÃO É SÓ VISTO. É SENTIDO.</span>
            <div>
              <b>Estratégia</b>
              <i>✳</i>
              <b>Criatividade</b>
              <i>✳</i>
              <b>Narrativa</b>
              <i>✳</i>
              <b>Impacto</b>
            </div>
          </div>
        </div>
        <section className="projects container" id="projetos">
          <div className="section-eyebrow">
            <span /> PORTFÓLIO SELECIONADO{" "}
            <span className="section-number">01 /</span>
          </div>
          <div className="section-heading">
            <h2>
              Cada projeto, <span>uma história.</span>
            </h2>
            <p>
              Um pouco do meu olhar.
              <br />
              Muito do que podemos criar juntos.
            </p>
          </div>
          <div className="gallery-toolbar">
            <div className="filters" aria-label="Filtrar por categoria">
              {["Todos", ...categoryOptions].map((c) => (
                <button
                  key={c}
                  className={filter === c ? "selected" : ""}
                  aria-pressed={filter === c}
                  onClick={() => setFilter(c)}
                >
                  {c}
                  {c === "Todos" && (
                    <span>{String(videos.length).padStart(2, "0")}</span>
                  )}
                </button>
              ))}
            </div>
            <label className="search">
              <Search size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar projeto"
                aria-label="Buscar projeto"
              />
              {search && (
                <button aria-label="Limpar busca" onClick={() => setSearch("")}>
                  <X size={14} />
                </button>
              )}
            </label>
          </div>
          {loading ? (
            <div className="video-grid" aria-label="Carregando projetos">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton" />
              ))}
            </div>
          ) : error ? (
            <div className="empty-state" role="alert">
              <p>{error}</p>
              <button className="button button-green" onClick={load}>
                Tentar novamente
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <Film />
              <h3>
                {videos.length
                  ? "Nenhum projeto encontrado"
                  : "Novas histórias estão chegando."}
              </h3>
              <p>
                {videos.length
                  ? "Experimente outra busca ou categoria."
                  : "Em breve, novos projetos por aqui."}
              </p>
              {videos.length > 0 && (
                <button
                  className="button button-outline"
                  onClick={() => {
                    setSearch("");
                    setFilter("Todos");
                  }}
                >
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="video-grid">
              {filtered.map((v, i) => {
                const demo = demoVideos.find((d) => d.id === v.id);
                return (
                  <button
                    className="video-card"
                    key={v.id}
                    onClick={() => setSelected(v)}
                  >
                    <div className="thumbnail">
                      <img
                        src={
                          demo?.image ||
                          `https://i.ytimg.com/vi/${v.videoId}/maxresdefault.jpg`
                        }
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (!img.dataset.fallback) {
                            img.dataset.fallback = "true";
                            img.src = `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;
                          }
                        }}
                        alt={v.title}
                        loading="lazy"
                      />
                      <span className="category-chip">{v.category}</span>
                      <span className="card-play">
                        <Play size={17} fill="currentColor" />
                      </span>
                      {demo && (
                        <span className="poster-label">{demo.label}</span>
                      )}
                      <span className="card-bottom-label">
                        {demo ? "PROJETO DEMONSTRATIVO" : "FILME SELECIONADO"}
                      </span>
                      {demo && (
                        <span className="duration">{demo.duration}</span>
                      )}
                    </div>
                    <div className="card-heading">
                      <h3>{v.title}</h3>
                      <ArrowUpRight size={19} />
                    </div>
                    <p>{v.description}</p>
                    <span className="project-index">
                      {String(i + 1).padStart(2, "0")} /{" "}
                      {v.category.toUpperCase()}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="portfolio-bottom">
            <span>Histórias diferentes. A mesma atenção a cada detalhe.</span>
            <a href="#contato">
              Seu projeto pode ser o próximo <ArrowUpRight size={16} />
            </a>
          </div>
        </section>
        <section id="sobre" className="about-section">
          <div className="container about-grid">
            <div className="about-visual">
              <img
                src="https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1000&q=85"
                alt="Câmera profissional em uma produção audiovisual"
                loading="lazy"
              />
              <span>
                POR TRÁS DOS FRAMES <ArrowUpRight size={20} />
              </span>
            </div>
            <div className="about-copy">
              <div className="section-eyebrow">
                <span /> PRAZER, SOU A FRAME{" "}
                <span className="section-number">02 /</span>
              </div>
              <h2>
                Um olhar curioso.
                <br />
                Infinitas <em>possibilidades.</em>
              </h2>
              <p>
                Acredito que a melhor edição é aquela que faz você sentir. É
                encontrar o ritmo certo, valorizar os pequenos detalhes e dar
                espaço para a história acontecer.
              </p>
              <p>
                Da ideia à entrega final, trabalho perto de você para
                transformar sua visão em um vídeo com identidade. Porque cada
                frame tem um propósito.
              </p>
              <a className="text-link" href="#contato">
                Vamos criar algo juntos <ArrowUpRight size={18} />
              </a>
              <div className="about-signature">
                frame<span>feito com intenção.</span>
              </div>
            </div>
          </div>
        </section>
        <section id="servicos" className="services container">
          <div className="section-eyebrow">
            <span /> DO PRIMEIRO AO ÚLTIMO FRAME{" "}
            <span className="section-number">03 /</span>
          </div>
          <div className="section-heading">
            <h2>
              Sua visão. <span>Meu próximo corte.</span>
            </h2>
            <p>
              Uma produção completa,
              <br />
              com cuidado em cada etapa.
            </p>
          </div>
          <div className="services-grid">
            {services.map((s, i) => (
              <button
                key={s.title}
                className={`service-card ${service === i ? "expanded" : ""}`}
                onClick={() => setService(service === i ? null : i)}
                aria-expanded={service === i}
              >
                <s.icon size={27} />
                <span className="service-no">0{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.detail}</p>
                <span className="service-more">
                  {service === i
                    ? "Vamos conversar sobre seu projeto?"
                    : "Explore as possibilidades"}
                  {service === i ? (
                    <ArrowUpRight size={17} />
                  ) : (
                    <Plus size={17} />
                  )}
                </span>
                {service === i && (
                  <span className="service-extra">
                    Conte sua ideia pelo contato abaixo. Vamos definir formato,
                    prazo e escopo juntos.
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      </main>
      <footer className="container public-footer">
        <div className="footer-top">
          <Logo />
          <p>Edição com intenção. Histórias que ficam.</p>
          <div className="footer-anchor">
            <a href="#projetos" aria-label="Voltar aos projetos">
              <ArrowUpRight size={19} />
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} FRAME. Todos os direitos reservados.
          </span>
          <span>
            Feito no Brasil. Criado para o mundo.{" "}
            <span className="brazil-dot" />
          </span>
          <a href="/admin">
            Área do editor <ArrowRight size={12} />
          </a>
        </div>
      </footer>
      <ContactDock />
      {selected && (
        <VideoModal video={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
export default App;
