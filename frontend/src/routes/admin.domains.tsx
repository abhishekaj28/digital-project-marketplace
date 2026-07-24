import { createFileRoute, redirect } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/AdminShell";
import { fetchDomains, CATEGORIES } from "@/lib/data";
import { useState, useEffect } from "react";
import { Pencil, Trash2, Plus, X, FileText, Upload, Loader2, ArrowLeft, Layers, FileArchive } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import API from "@/services/api";

export const Route = createFileRoute("/admin/domains")({
  beforeLoad: () => {
    const token = typeof window !== "undefined" && localStorage.getItem("ph-admin-token");
    if (!token) {
      throw redirect({ to: "/unauthorized" });
    }
  },
  head: () => ({ meta: [{ title: "Domains & Projects — Admin" }] }),
  component: DomainsAdmin,
});

const DEFAULT_PLACEHOLDER = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop";

function normalizeImgSrc(src: string): string {
  if (!src) return DEFAULT_PLACEHOLDER;
  if (src.startsWith("http")) return src;
  const baseUrl = API.defaults.baseURL || "http://localhost:5000";
  return `${baseUrl}${src.startsWith("/") ? "" : "/"}${src}`;
}

type ViewState = 
  | { type: "domains" }
  | { type: "projects"; domain: any };

function DomainsAdmin() {
  const [view, setView] = useState<ViewState>({ type: "domains" });
  const [domains, setDomains] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [domainModalOpen, setDomainModalOpen] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<any>(null);
  
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);

  const loadDomains = async () => {
    setLoading(true);
    try {
      const res = await API.get("/api/domains");
      setDomains(res.data);
    } catch (err) {
      console.error("Failed to load domains:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async (domainId: string) => {
    setLoading(true);
    try {
      const res = await API.get(`/api/domains/${domainId}/projects`);
      setProjects(res.data);
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view.type === "domains") {
      loadDomains();
    } else {
      loadProjects(view.domain.id);
    }
  }, [view]);

  const handleDeleteDomain = async (id: string, count: number) => {
    if (count > 0) {
      return alert("Delete all Projects before deleting this Domain.");
    }
    if (!confirm("Are you sure you want to delete this domain category?")) return;
    try {
      await API.delete(`/api/admin/domains/${id}`);
      loadDomains();
      await fetchDomains(); // Refresh cache
    } catch (err: any) {
      alert("Failed to delete domain: " + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm("Are you sure you want to delete this project bundle?")) return;
    try {
      await API.delete(`/api/admin/projects/${id}`);
      if (view.type === "projects") {
        loadProjects(view.domain.id);
      }
    } catch (err: any) {
      alert("Failed to delete project: " + (err.response?.data?.error || err.message));
    }
  };

  return (
    <AdminShell title={view.type === "domains" ? "Domains" : `Projects: ${view.domain.name}`}>
      {view.type === "domains" ? (
        <>
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="font-serif text-3xl mb-1 text-left">Manage Domains</h1>
              <p className="text-muted-foreground text-sm text-left">
                Create and edit your primary academic domain categories.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedDomain(null);
                setDomainModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-md"
            >
              <Plus className="size-4" /> New Domain
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground font-mono">Loading domains...</div>
          ) : (
            <div className="border border-border bg-card rounded-md overflow-hidden">
              <div className="grid grid-cols-12 px-6 py-3 border-b border-border font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-left">
                <div className="col-span-6">Domain</div>
                <div className="col-span-3">Project Count</div>
                <div className="col-span-3 text-right">Actions</div>
              </div>
              {domains.map((d) => (
                <div
                  key={d.id}
                  className="grid grid-cols-12 px-6 py-4 border-b border-border last:border-0 items-center hover:bg-accent/30 text-left"
                >
                  <div className="col-span-6 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium truncate">{d.name}</div>

                    </div>
                    <div className="text-xs text-muted-foreground truncate">{d.description}</div>
                  </div>
                  <div className="col-span-3">
                    <span className="font-mono text-xs px-2 py-1 rounded bg-secondary/80 text-foreground font-semibold">
                      {d.count} {d.count === 1 ? "Project" : "Projects"}
                    </span>
                  </div>
                  <div className="col-span-3 flex justify-end gap-2 items-center">
                    <button
                      onClick={() => setView({ type: "projects", domain: d })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border text-foreground hover:bg-secondary text-[10px] uppercase font-mono tracking-wider rounded"
                    >
                      <Layers className="size-3" /> Manage Projects
                    </button>
                    <button
                      onClick={() => {
                        setSelectedDomain(d);
                        setDomainModalOpen(true);
                      }}
                      className="size-8 grid place-items-center rounded-md hover:bg-accent text-muted-foreground"
                      title="Edit Domain"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDomain(d.id, d.count)}
                      className="size-8 grid place-items-center rounded-md hover:bg-destructive/10 text-destructive"
                      title="Delete Domain"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {domains.length === 0 && (
                <div className="text-center py-12 text-muted-foreground font-mono">
                  No domain categories created yet.
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-4">
            <button
              onClick={() => setView({ type: "domains" })}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-mono uppercase tracking-wider mb-2 transition-colors"
            >
              <ArrowLeft className="size-4" /> Back to Domains
            </button>
          </div>

          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="font-serif text-3xl mb-1 text-left">Projects inside "{view.domain.name}"</h1>
              <p className="text-muted-foreground text-sm text-left">
                Manage project details, difficulty levels, prices, and package files.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedProject(null);
                setProjectModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-md"
            >
              <Plus className="size-4" /> New Project
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground font-mono">Loading projects...</div>
          ) : (
            <div className="border border-border bg-card rounded-md overflow-hidden">
              <div className="grid grid-cols-12 px-6 py-3 border-b border-border font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-left">
                <div className="col-span-5">Project Name</div>
                <div className="col-span-2">Difficulty</div>
                <div className="col-span-2">Price</div>
                <div className="col-span-1">Files</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-12 px-6 py-4 border-b border-border last:border-0 items-center hover:bg-accent/30 text-left"
                >
                  <div className="col-span-5 min-w-0">
                    <div className="font-medium truncate">{p.projectName}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.description}</div>
                  </div>
                  <div className="col-span-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                      {p.difficulty}
                    </span>
                  </div>
                  <div className="col-span-2 font-medium">₹{p.price.toLocaleString("en-IN")}</div>
                  <div className="col-span-1 font-mono text-xs">
                    {(p.filesList || p.files || []).length} files
                  </div>
                  <div className="col-span-2 flex justify-end gap-2 items-center">
                    <button
                      onClick={() => {
                        setSelectedProject(p);
                        setProjectModalOpen(true);
                      }}
                      className="size-8 grid place-items-center rounded-md hover:bg-accent text-muted-foreground"
                      title="Edit Project & Files"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteProject(p.id)}
                      className="size-8 grid place-items-center rounded-md hover:bg-destructive/10 text-destructive"
                      title="Delete Project"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {projects.length === 0 && (
                <div className="text-center py-12 text-muted-foreground font-mono">
                  No projects created in this domain category yet.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Domain Category Edit/Create Modal */}
      <AnimatePresence>
        {domainModalOpen && (
          <DomainCategoryModal
            domain={selectedDomain}
            onClose={() => setDomainModalOpen(false)}
            onSuccess={() => {
              setDomainModalOpen(false);
              loadDomains();
              fetchDomains();
            }}
          />
        )}
      </AnimatePresence>

      {/* Project Edit/Create Modal with Nested File manager */}
      <AnimatePresence>
        {projectModalOpen && (
          <ProjectBundleModal
            project={selectedProject}
            domainId={view.type === "projects" ? view.domain.id : ""}
            onClose={() => setProjectModalOpen(false)}
            onSuccess={() => {
              setProjectModalOpen(false);
              if (view.type === "projects") {
                loadProjects(view.domain.id);
              }
            }}
          />
        )}
      </AnimatePresence>
    </AdminShell>
  );
}

// 1. DomainCategoryModal implementation
function DomainCategoryModal({
  domain,
  onClose,
  onSuccess,
}: {
  domain: any | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(domain?.name || "");
  const categoryName = "General";
  const [description, setDescription] = useState(domain?.description || "");
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert("Domain name is required");

    setLoading(true);
    const fd = new FormData();
    fd.append("name", name);
    fd.append("categoryName", categoryName);
    fd.append("categoryId", categoryName);
    fd.append("description", description);
    if (thumbnail) {
      fd.append("thumbnail", thumbnail);
    }

    try {
      if (domain) {
        await API.put(`/api/admin/domains/${domain.id}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await API.post("/api/admin/domains", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      onSuccess();
    } catch (err: any) {
      console.error(err);
      alert("Failed to save domain: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm grid place-items-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        className="w-full max-w-md bg-card border border-border rounded-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="text-left">
              <div className="font-mono text-[10px] uppercase tracking-widest text-primary">
                Category Manager
              </div>
              <h3 className="font-serif text-2xl">{domain ? "Edit Domain Category" : "Create Domain Category"}</h3>
            </div>
            <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-full hover:bg-accent">
              <X className="size-4" />
            </button>
          </div>
          
          <div className="p-6 space-y-4 text-left">

            <label className="block">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                Domain Name *
              </div>
              <input
                required
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-11 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </label>
            
            <label className="block">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                Description
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full min-h-[80px] p-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40 text-sm"
              />
            </label>

            <label className="block">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                Thumbnail Image
              </div>
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setThumbnail(file);
                }}
                className="w-full text-xs font-mono file:h-9 file:px-3 file:mr-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
              />
            </label>
          </div>

          <div className="p-6 border-t border-border flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-mono uppercase tracking-widest rounded-md hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-md disabled:opacity-60"
            >
              {loading ? "Saving..." : domain ? "Save Changes" : "Create"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

const AVAILABLE_RESOURCES = [
  "Source Code (ZIP)",
  "Project Report (PDF)",
  "Presentation (PPTX)",
  "Project Abstract (PDF)",
  "Viva Questions (PDF)",
  "README (TXT)",
  "Mini Project File",
  "IEEE Paper Document",
  "Lab Setup Guide"
];

// 2. ProjectBundleModal implementation (nested Project details & file uploads)
function ProjectBundleModal({
  project,
  domainId,
  onClose,
  onSuccess,
}: {
  project: any | null;
  domainId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    projectName: project?.projectName || project?.title || "",
    description: project?.description || "",
    price: project?.price?.toString() || "0",
    difficulty: project?.difficulty || "Medium",
    technologies: project?.technologies?.join(", ") || "",
  });
  
  const [resourcesIncluded, setResourcesIncluded] = useState<string[]>(
    project?.resourcesIncluded || []
  );

  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<any[]>(project?.filesList || project?.files || []);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<any>({ status: "idle" });

  const formatBytes = (bytes: number) => {
    if (bytes <= 0 || isNaN(bytes)) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const refreshFiles = async () => {
    if (!project) return;
    try {
      const res = await API.get(`/api/projects/${project.id}`);
      if (res.data && res.data.filesList) {
        setFiles(res.data.filesList);
      }
    } catch (err) {
      console.error("Failed to refresh files list:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.projectName.trim()) return alert("Project Name is required");

    setLoading(true);
    const fd = new FormData();
    fd.append("projectName", form.projectName);
    fd.append("title", form.projectName);
    fd.append("description", form.description);
    fd.append("price", form.price);
    fd.append("difficulty", form.difficulty);
    fd.append("technologies", form.technologies);
    if (domainId) {
      fd.append("domainId", domainId);
      fd.append("category_id", domainId);
    }
    if (thumbnail) {
      fd.append("thumbnail", thumbnail);
    }

    resourcesIncluded.forEach((res) => {
      fd.append("resourcesIncluded", res);
    });

    try {
      if (project) {
        await API.put(`/api/admin/projects/${project.id}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await API.post("/api/admin/projects", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      onSuccess();
    } catch (err: any) {
      console.error(err);
      alert("Failed to save project: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm grid place-items-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        className="w-full max-w-lg bg-card border border-border rounded-md shadow-2xl my-8 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-primary">
                Project Bundle Manager
              </div>
              <h3 className="font-serif text-2xl">{project ? "Edit Project Bundle" : "Create Project Bundle"}</h3>
            </div>
            <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-full hover:bg-accent">
              <X className="size-4" />
            </button>
          </div>

          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            <label className="block">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                Project Name *
              </div>
              <input
                required
                type="text"
                value={form.projectName}
                onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                className="w-full h-11 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </label>

            <label className="block">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                Short Description
              </div>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full min-h-[80px] p-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40 text-sm"
              />
            </label>

            <label className="block">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                Price (INR)
              </div>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full h-11 px-3 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40"
              />
            </label>



            {/* Resources checkbox list */}
            <div className="block">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                Resources checklist
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 border border-border rounded-md p-4 bg-background max-h-[140px] overflow-y-auto">
                {AVAILABLE_RESOURCES.map((res) => {
                  const checked = resourcesIncluded.includes(res);
                  return (
                    <label key={res} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setResourcesIncluded([...resourcesIncluded, res]);
                          } else {
                            setResourcesIncluded(resourcesIncluded.filter((r) => r !== res));
                          }
                        }}
                        className="size-4 rounded border border-input text-primary focus:ring-ring"
                      />
                      <span>{res}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Cover upload */}
            <label className="block">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                Project Thumbnail Image
              </div>
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setThumbnail(file);
                }}
                className="w-full text-xs font-mono file:h-9 file:px-3 file:mr-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
              />
            </label>

            {/* Nested Project Files List and File Uploads */}
            {project && (
              <div className="border-t border-border pt-6 mt-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-serif text-lg">Project Files ({files.length})</h4>
                  <label 
                    htmlFor="project-file-upload-input"
                    className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-sm hover:opacity-90"
                  >
                    {uploadingFile ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Plus className="size-3.5" />
                    )}
                    Upload Resource
                  </label>
                  <input
                    id="project-file-upload-input"
                    type="file"
                    disabled={uploadingFile}
                    accept=".pdf,.zip,.ppt,.pptx,.doc,.docx"
                    className="sr-only"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      setUploadingFile(true);
                      setUploadStatus({
                        fileName: file.name,
                        fileSize: formatBytes(file.size),
                        status: "uploading",
                        message: "Uploading..."
                      });

                      const fd = new FormData();
                      fd.append("file", file);
                      try {
                        await API.post(`/api/admin/projects/${project.id}/files`, fd, {
                          headers: { "Content-Type": "multipart/form-data" },
                        });
                        setUploadStatus({
                          fileName: file.name,
                          fileSize: formatBytes(file.size),
                          status: "success",
                          message: "Upload Successful"
                        });
                        await refreshFiles();
                        setTimeout(() => setUploadStatus({ status: "idle" }), 3000);
                      } catch (err: any) {
                        const errMsg = err.response?.data?.error || err.message || "Upload Failed";
                        setUploadStatus({
                          fileName: file.name,
                          fileSize: formatBytes(file.size),
                          status: "error",
                          message: errMsg
                        });
                      } finally {
                        setUploadingFile(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </div>

                {uploadStatus.status !== "idle" && (
                  <div className={`mb-4 p-3 border rounded-md font-mono text-xs ${
                    uploadStatus.status === "uploading" ? "bg-accent/40 border-accent text-accent-foreground animate-pulse" :
                    uploadStatus.status === "success" ? "bg-primary/10 border-primary text-primary" :
                    "bg-destructive/10 border-destructive text-destructive"
                  }`}>
                    <div className="flex justify-between font-semibold mb-1">
                      <span className="truncate max-w-[70%]">{uploadStatus.fileName}</span>
                      <span>{uploadStatus.fileSize}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 text-right font-bold uppercase">
                      {uploadStatus.message}
                    </div>
                  </div>
                )}

                <div className="space-y-2 max-h-[180px] overflow-y-auto">
                  {files.map((file: any) => (
                    <div key={file.filename} className="flex items-center justify-between p-3 bg-secondary rounded border border-border">
                      <div className="min-w-0 flex-1 mr-4">
                        <div className="text-sm font-mono truncate">{file.name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase">
                          {file.type} · {file.size}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            const newName = prompt("Enter new name for the file:", file.name);
                            if (!newName || newName.trim() === "") return;
                            try {
                              await API.put(`/api/admin/projects/${project.id}/files/${file.filename}`, { name: newName.trim() });
                              await refreshFiles();
                            } catch (err: any) {
                              alert("Rename failed: " + (err.response?.data?.error || err.message));
                            }
                          }}
                          className="size-8 grid place-items-center rounded hover:bg-accent text-muted-foreground"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <label 
                          htmlFor={`replace-file-input-${file.filename}`}
                          className="size-8 grid place-items-center rounded hover:bg-accent text-muted-foreground cursor-pointer"
                        >
                          <Upload className="size-3.5" />
                        </label>
                        <input
                          id={`replace-file-input-${file.filename}`}
                          type="file"
                          accept=".pdf,.zip,.ppt,.pptx,.doc,.docx"
                          className="sr-only"
                          onChange={async (e) => {
                            const newFile = e.target.files?.[0];
                            if (!newFile) return;

                            setUploadStatus({
                              fileName: newFile.name,
                              fileSize: formatBytes(newFile.size),
                              status: "uploading",
                              message: "Replacing..."
                            });

                            const fd = new FormData();
                            fd.append("file", newFile);
                            try {
                              await API.put(`/api/admin/projects/${project.id}/files/${file.filename}`, fd, {
                                headers: { "Content-Type": "multipart/form-data" },
                              });
                              setUploadStatus({
                                fileName: newFile.name,
                                fileSize: formatBytes(newFile.size),
                                status: "success",
                                message: "Replace Successful"
                              });
                              await refreshFiles();
                              setTimeout(() => setUploadStatus({ status: "idle" }), 3000);
                            } catch (err: any) {
                              const errMsg = err.response?.data?.error || err.message || "Replace Failed";
                              setUploadStatus({
                                fileName: newFile.name,
                                fileSize: formatBytes(newFile.size),
                                status: "error",
                                message: errMsg
                              });
                            } finally {
                              e.target.value = "";
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm("Are you sure you want to delete this file?")) return;
                            try {
                              await API.delete(`/api/admin/projects/${project.id}/files/${file.filename}`);
                              await refreshFiles();
                            } catch (err: any) {
                              alert("Delete failed: " + (err.response?.data?.error || err.message));
                            }
                          }}
                          className="size-8 grid place-items-center rounded hover:bg-destructive/10 text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {files.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground text-xs font-mono border border-dashed border-border rounded">
                      No files uploaded to this project yet.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-border flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-mono uppercase tracking-widest rounded-md hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded-md disabled:opacity-60"
            >
              {loading ? "Saving..." : project ? "Save Changes" : "Create"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
