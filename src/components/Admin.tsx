import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Plus,
  LogOut,
  Pencil,
  Trash2,
  LockKeyhole,
  Film,
  X,
  Check,
  LoaderCircle,
  Star,
} from "lucide-react";
import { api, ApiError, type Category, type Video } from "../api";
import {
  categories as defaultCategories,
  extractYouTubeId,
} from "../../shared/youtube";
const blank = {
  title: "",
  description: "",
  youtubeUrl: "",
  category: "Comercial",
  isShowreel: false,
};
export function Admin() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null),
    [videos, setVideos] = useState<Video[]>([]),
    [categoryOptions, setCategoryOptions] = useState<Category[]>(
      defaultCategories.map((name, index) => ({
        id: `fallback-${index}`,
        name,
        isDefault: true,
        createdAt: "",
      })),
    ),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [editing, setEditing] = useState<Video | null>(null),
    [form, setForm] = useState(blank),
    [showForm, setShowForm] = useState(false),
    [deleting, setDeleting] = useState<Video | null>(null),
    [loading, setLoading] = useState(false),
    [newCategory, setNewCategory] = useState("");
  const deleteDialog = useRef<HTMLDialogElement>(null);
  function handleError(e: unknown) {
    if (e instanceof ApiError && e.status === 401) setAuthenticated(false);
    setError(
      e instanceof Error ? e.message : "Ocorreu um erro. Tente novamente.",
    );
  }
  async function refresh() {
    setLoading(true);
    try {
      const [loadedVideos, loadedCategories] = await Promise.all([
        api<Video[]>("/videos"),
        api<Category[]>("/categories"),
      ]);
      setVideos(loadedVideos);
      setCategoryOptions(loadedCategories);
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    api("/auth/me")
      .then(() => {
        setAuthenticated(true);
        void refresh();
      })
      .catch((e) => {
        setAuthenticated(false);
        if (!(e instanceof ApiError && e.status === 401)) handleError(e);
      });
  }, []);
  useEffect(() => {
    if (deleting) deleteDialog.current?.showModal();
  }, [deleting]);
  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setPassword("");
      setAuthenticated(true);
      await refresh();
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await api("/auth/logout", { method: "POST" });
      setAuthenticated(false);
      setShowForm(false);
      setVideos([]);
      setCategoryOptions([]);
      setNotice("");
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }
  function openForm(v?: Video) {
    setError("");
    setNotice("");
    setEditing(v || null);
    setForm(
      v
        ? {
            title: v.title,
            description: v.description,
            youtubeUrl: v.youtubeUrl,
            category: v.category,
            isShowreel: v.isShowreel,
          }
        : blank,
    );
    setShowForm(true);
    setTimeout(() => document.getElementById("project-title")?.focus(), 50);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!extractYouTubeId(form.youtubeUrl)) {
      setError("Use uma URL válida do YouTube: watch, youtu.be ou shorts.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(editing ? `/videos/${editing.id}` : "/videos", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      setShowForm(false);
      setNotice(
        editing ? "Projeto atualizado." : "Projeto publicado com sucesso.",
      );
      await refresh();
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setError("");
    try {
      await api(`/videos/${deleting.id}`, { method: "DELETE" });
      setDeleting(null);
      setNotice("Projeto excluído.");
      await refresh();
    } catch (e) {
      setDeleting(null);
      handleError(e);
    } finally {
      setBusy(false);
    }
  }
  async function chooseShowreel(video: Video) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/videos/${video.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: video.title,
          description: video.description,
          youtubeUrl: video.youtubeUrl,
          category: video.category,
          isShowreel: true,
        }),
      });
      setNotice(`“${video.title}” agora é o showreel do site.`);
      await refresh();
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }
  async function addCategory(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const created = await api<Category>("/categories", {
        method: "POST",
        body: JSON.stringify({ name: newCategory }),
      });
      setCategoryOptions((current) => [...current, created]);
      setForm((current) => ({ ...current, category: created.name }));
      setNewCategory("");
      setNotice(`Categoria “${created.name}” adicionada.`);
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }
  async function removeCategory(category: Category) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/categories/${category.id}`, { method: "DELETE" });
      setCategoryOptions((current) =>
        current.filter(({ id }) => id !== category.id),
      );
      if (form.category === category.name)
        setForm((current) => ({
          ...current,
          category: categoryOptions[0]?.name || "Comercial",
        }));
      setNotice(`Categoria “${category.name}” removida.`);
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }
  const id = extractYouTubeId(form.youtubeUrl);
  return (
    <div className="admin-shell">
      <header className="container admin-header">
        <a className="logo" href="/">
          FRAME<span>®</span>
          <i />
        </a>
        <a className="text-link" href="/">
          Ver portfólio <ArrowUpRight size={16} />
        </a>
      </header>
      <main className="container admin-main">
        {authenticated === null ? (
          <div className="empty-state">
            <LoaderCircle className="spin" />
            <p>Verificando sua sessão…</p>
          </div>
        ) : !authenticated ? (
          <div className="login-card">
            <div className="login-icon">
              <LockKeyhole size={26} />
            </div>
            <span className="section-eyebrow">SEU ESPAÇO CRIATIVO</span>
            <h1>Bom ter você de volta.</h1>
            <p>Entre para gerenciar suas histórias e projetos.</p>
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
            <form onSubmit={login}>
              <label>
                E-mail
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                />
              </label>
              <label>
                Senha
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Sua senha de administrador"
                  maxLength={72}
                />
              </label>
              <button className="button button-green" disabled={busy}>
                {busy ? "Entrando…" : "Entrar no painel"}
                <ArrowUpRight size={17} />
              </button>
            </form>
            <a className="login-back" href="/">
              <ArrowLeft size={14} /> Voltar ao portfólio
            </a>
          </div>
        ) : (
          <>
            <div className="dashboard-heading">
              <div>
                <div className="section-eyebrow">
                  <span /> PAINEL DO EDITOR
                </div>
                <h1>Suas histórias.</h1>
                <p>Gerencie os projetos que fazem parte do seu portfólio.</p>
              </div>
              <button
                className="button button-outline"
                onClick={logout}
                disabled={busy}
              >
                <LogOut size={16} /> Sair
              </button>
            </div>
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
            {notice && (
              <div className="alert success" role="status">
                <Check size={17} />
                {notice}
              </div>
            )}
            <section className="category-manager">
              <div className="category-manager-copy">
                <span className="section-eyebrow">CATEGORIAS DO PORTFÓLIO</span>
                <h2>Organize do seu jeito.</h2>
                <p>
                  Novas categorias aparecem automaticamente nos filtros do site.
                </p>
              </div>
              <form className="category-form" onSubmit={addCategory}>
                <label htmlFor="new-category">Nova categoria</label>
                <div>
                  <input
                    id="new-category"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Ex.: Fashion film"
                    maxLength={40}
                    required
                  />
                  <button className="button button-green" disabled={busy}>
                    <Plus size={17} /> Adicionar
                  </button>
                </div>
              </form>
              <div className="category-list" aria-label="Categorias atuais">
                {categoryOptions.map((category) => (
                  <span className="category-item" key={category.id}>
                    {category.name}
                    {!category.isDefault && (
                      <button
                        type="button"
                        aria-label={`Remover categoria ${category.name}`}
                        title="Remover categoria"
                        disabled={busy}
                        onClick={() => removeCategory(category)}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </section>
            <div className="admin-toolbar">
              <span>
                <Film size={19} /> {videos.length} projetos publicados
              </span>
              <button
                className="button button-green"
                onClick={() => openForm()}
                disabled={busy}
              >
                <Plus size={18} /> Novo projeto
              </button>
            </div>
            {showForm && (
              <section className="project-form">
                <div className="form-heading">
                  <h2>
                    {editing
                      ? "Editar projeto"
                      : "Um novo projeto começa aqui."}
                  </h2>
                  <button
                    className="icon-button"
                    aria-label="Fechar formulário"
                    disabled={busy}
                    onClick={() => setShowForm(false)}
                  >
                    <X />
                  </button>
                </div>
                <form onSubmit={save}>
                  <div className="form-grid">
                    <div>
                      <label>
                        Título do projeto
                        <input
                          id="project-title"
                          value={form.title}
                          onChange={(e) =>
                            setForm({ ...form, title: e.target.value })
                          }
                          maxLength={120}
                          required
                          placeholder="Dê um nome à sua história"
                        />
                      </label>
                      <label>
                        URL do YouTube
                        <input
                          type="url"
                          value={form.youtubeUrl}
                          onChange={(e) =>
                            setForm({ ...form, youtubeUrl: e.target.value })
                          }
                          maxLength={2048}
                          required
                          placeholder="https://www.youtube.com/watch?v=…"
                        />
                      </label>
                      <small>
                        Compatível com links watch, youtu.be e Shorts.
                      </small>
                      <label>
                        Categoria
                        <select
                          value={form.category}
                          onChange={(e) =>
                            setForm({ ...form, category: e.target.value })
                          }
                        >
                          {categoryOptions.map(({ id, name }) => (
                            <option key={id}>{name}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Descrição
                        <textarea
                          value={form.description}
                          onChange={(e) =>
                            setForm({ ...form, description: e.target.value })
                          }
                          maxLength={5000}
                          required
                          rows={4}
                          placeholder="Conte sobre o projeto, a ideia e o seu trabalho…"
                        />
                      </label>
                      <label className="showreel-toggle">
                        <input
                          type="checkbox"
                          checked={form.isShowreel}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              isShowreel: e.target.checked,
                            })
                          }
                        />
                        <span>
                          <strong>Usar como showreel</strong>
                          Este vídeo abrirá no botão e no destaque do topo.
                        </span>
                      </label>
                    </div>
                    <div className="form-preview">
                      {id ? (
                        <>
                          <img
                            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
                            alt="Prévia da thumbnail do YouTube"
                          />
                          <h3>{form.title || "Título do projeto"}</h3>
                          <p>{form.category}</p>
                        </>
                      ) : (
                        <div>
                          <Film size={34} />
                          <p>
                            Adicione uma URL válida
                            <br />
                            para visualizar a thumbnail.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="button button-outline"
                      disabled={busy}
                      onClick={() => setShowForm(false)}
                    >
                      Cancelar
                    </button>
                    <button className="button button-green" disabled={busy}>
                      {busy
                        ? "Salvando…"
                        : editing
                          ? "Salvar alterações"
                          : "Publicar projeto"}
                      <Check size={17} />
                    </button>
                  </div>
                </form>
              </section>
            )}
            {loading ? (
              <div className="empty-state">Carregando projetos…</div>
            ) : (
              <div className="admin-video-list">
                {videos.length === 0 ? (
                  <div className="empty-state">
                    <Film size={30} />
                    <h3>Seu primeiro frame está por vir.</h3>
                    <p>Use “Novo projeto” para começar seu portfólio.</p>
                  </div>
                ) : (
                  videos.map((v) => (
                    <article className="admin-video" key={v.id}>
                      <img
                        src={`https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`}
                        alt=""
                      />
                      <div>
                        <span className="section-eyebrow">
                          {v.category}
                          {v.isShowreel && (
                            <b className="showreel-badge">SHOWREEL</b>
                          )}
                        </span>
                        <h3>{v.title}</h3>
                        <p>{v.description}</p>
                      </div>
                      <div className="admin-video-actions">
                        <button
                          className={`icon-button showreel-button ${v.isShowreel ? "selected" : ""}`}
                          aria-label={
                            v.isShowreel
                              ? `Showreel atual: ${v.title}`
                              : `Definir ${v.title} como showreel`
                          }
                          title={
                            v.isShowreel
                              ? "Showreel atual"
                              : "Definir como showreel"
                          }
                          disabled={busy || v.isShowreel}
                          onClick={() => chooseShowreel(v)}
                        >
                          <Star
                            size={18}
                            fill={v.isShowreel ? "currentColor" : "none"}
                          />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Editar ${v.title}`}
                          disabled={busy}
                          onClick={() => openForm(v)}
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          className="icon-button delete-button"
                          aria-label={`Excluir ${v.title}`}
                          disabled={busy}
                          onClick={() => setDeleting(v)}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            )}
          </>
        )}
        {deleting && (
          <dialog
            className="confirm-dialog"
            ref={deleteDialog}
            onCancel={() => !busy && setDeleting(null)}
          >
            <h2>Excluir este projeto?</h2>
            <p>
              “{deleting.title}” será removido do portfólio. Esta ação não pode
              ser desfeita.
            </p>
            <div className="form-actions">
              <button
                className="button button-outline"
                disabled={busy}
                onClick={() => setDeleting(null)}
              >
                Cancelar
              </button>
              <button
                className="button button-danger"
                disabled={busy}
                onClick={remove}
              >
                {busy ? "Excluindo…" : "Excluir projeto"}
              </button>
            </div>
          </dialog>
        )}
      </main>
      <div className="admin-footer">
        FRAME® · Seu próximo grande corte começa aqui.
      </div>
    </div>
  );
}
