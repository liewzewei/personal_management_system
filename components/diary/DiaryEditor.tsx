/**
 * Diary rich text editor component using Tiptap.
 *
 * Features: title input, tag management, toolbar with formatting buttons,
 * auto-save with debounce (2s), image upload to Supabase Storage,
 * word count, and save status indicator.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Mathematics } from "@tiptap/extension-mathematics";
import { common, createLowlight } from "lowlight";
import "katex/dist/katex.min.css";
import {
  Bold,
  Italic,
  UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Link2,
  ImageIcon,
  Undo2,
  Redo2,
  Check,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Code,
  FileCode2,
  Sigma,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/lib/hooks/use-toast";
import { format } from "date-fns";
import type { DiaryEntry } from "@/types";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface DiaryEditorProps {
  entry: DiaryEntry;
  allTags: string[];
  onSaved: (entry: DiaryEntry) => void;
  onBack?: () => void;
}

const lowlight = createLowlight(common);

// Custom extension to handle Tab key in code blocks
const CodeBlockTabHandler = Extension.create({
  name: "codeBlockTabHandler",

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive("codeBlock")) {
          return this.editor.commands.insertContent("  ");
        }
        return false;
      },
    };
  },
});

const CODE_LANGUAGES = [
  { value: "", label: "Auto" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash" },
  { value: "markdown", label: "Markdown" },
] as const;

export function DiaryEditor({ entry, allTags, onSaved, onBack }: DiaryEditorProps) {
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState(entry.title ?? "");
  const [tags, setTags] = useState<string[]>(entry.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [linkUrl, setLinkUrl] = useState("");
  const [failCount, setFailCount] = useState(0);
  const [deleted, setDeleted] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const entryIdRef = useRef(entry.id);

  // Initialize editor (only on client)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Underline,
      Link.configure({ autolink: true, openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder: "Write something..." }),
      CharacterCount,
      CodeBlockLowlight.configure({ lowlight }),
      Mathematics.configure({
        katexOptions: { throwOnError: false },
      }),
      CodeBlockTabHandler,
    ],
    content: mounted ? (entry.content ?? "") : "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-hidden min-h-[300px] px-1",
      },
    },
    onUpdate: () => {
      if (mounted) scheduleSave();
    },
    immediatelyRender: false,
  });

  // Mount effect
  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset state when entry changes
  useEffect(() => {
    entryIdRef.current = entry.id;
    setTitle(entry.title ?? "");
    setTags(entry.tags ?? []);
    setSaveStatus("idle");
    setFailCount(0);
    setDeleted(false);
  }, [entry.id, entry.title, entry.tags]);

  // Update editor content when entry changes (only after mounted)
  useEffect(() => {
    if (mounted && editor && entry.content) {
      const currentJson = JSON.stringify(editor.getJSON());
      const newJson = JSON.stringify(entry.content);
      if (currentJson !== newJson) {
        editor.commands.setContent(entry.content);
      }
    } else if (mounted && editor && !entry.content) {
      editor.commands.setContent("");
    }
  }, [entry.id, mounted, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus title on new empty entry
  useEffect(() => {
    if (!entry.title && !entry.content && titleRef.current) {
      titleRef.current.focus();
    }
  }, [entry.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const doSave = useCallback(async () => {
    if (!editor || deleted) return;
    setSaveStatus("saving");

    const json = editor.getJSON();
    const plainText = editor.getText();

    try {
      const res = await fetch(`/api/diary/${entryIdRef.current}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || null,
          content: json,
          content_text: plainText || null,
          tags: tags.length > 0 ? tags : null,
        }),
      });

      if (res.status === 404) {
        setDeleted(true);
        setSaveStatus("error");
        return;
      }

      const body = (await res.json()) as { data: DiaryEntry | null; error: string | null };
      if (body.data) {
        setSaveStatus("saved");
        setFailCount(0);
        onSaved(body.data);
        setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 3000);
      } else {
        setSaveStatus("error");
        setFailCount((c) => c + 1);
      }
    } catch {
      setSaveStatus("error");
      setFailCount((c) => c + 1);
    }
  }, [editor, title, tags, deleted, onSaved]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(doSave, 2000);
  }, [doSave]);

  // Save on title/tag changes
  useEffect(() => {
    scheduleSave();
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [title, tags, scheduleSave]);

  // Save on blur / route change
  useEffect(() => {
    const handleBlur = () => doSave();
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [doSave]);

  // Ctrl+S
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        doSave();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [doSave]);

  if (!mounted) {
    return null;
  }

  // Tag management
  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  // Image upload
  const handleImageUpload = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/gif,image/webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "Image too large. Max size is 5MB.", variant: "destructive" });
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/diary/upload", { method: "POST", body: formData });
        const body = (await res.json()) as { data: string | null; error: string | null };
        if (body.data && editor) {
          editor.chain().focus().setImage({ src: body.data }).run();
        } else {
          toast({ title: "Image upload failed. Try again.", variant: "destructive" });
        }
      } catch {
        toast({ title: "Image upload failed. Try again.", variant: "destructive" });
      }
    };
    input.click();
  };

  // Link insertion
  const handleSetLink = () => {
    if (!editor || !linkUrl) return;
    if (linkUrl === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run();
    }
    setLinkUrl("");
  };

  const filteredSuggestions = allTags.filter(
    (t) => !tags.includes(t) && t.toLowerCase().includes(tagInput.toLowerCase())
  );

  if (!editor) return null;

  if (deleted) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm font-medium">This entry was deleted.</p>
        <p className="text-xs text-muted-foreground">
          Your content has been preserved below — copy it before leaving.
        </p>
        <div className="mt-4 w-full rounded-md border bg-muted p-4 text-sm whitespace-pre-wrap">
          {editor.getText()}
        </div>
      </div>
    );
  }

  const wordCount = editor.storage.characterCount.words();

  return (
    <div className="flex h-full flex-col">
      {/* Mobile back button */}
      {onBack && (
        <div className="shrink-0 border-b p-2 md:hidden">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />
            Back
          </Button>
        </div>
      )}

      {/* Title */}
      <div className="shrink-0 px-4 pt-4">
        <Input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
          className="border-none text-xl font-semibold shadow-none focus-visible:ring-0 px-0 h-auto"
        />
      </div>

      {/* Metadata row */}
      <div className="shrink-0 px-4 py-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{format(new Date(entry.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
        <span className="text-border">|</span>
        {/* Tags */}
        <div className="flex flex-wrap items-center gap-1">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-[10px] cursor-pointer"
              onClick={() => removeTag(tag)}
            >
              {tag} ×
            </Badge>
          ))}
          <div className="relative">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && tagInput.trim()) {
                  e.preventDefault();
                  addTag(tagInput);
                }
              }}
              placeholder="Add tag..."
              className="h-5 w-20 border-none text-[10px] shadow-none focus-visible:ring-0 px-1"
            />
            {tagInput && filteredSuggestions.length > 0 && (
              <div className="absolute top-full left-0 z-20 mt-1 max-h-32 w-40 overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
                {filteredSuggestions.slice(0, 8).map((s) => (
                  <button
                    key={s}
                    className="w-full rounded px-2 py-1 text-left text-xs hover:bg-accent"
                    onClick={() => addTag(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t" />

      {/* Toolbar */}
      <div className="shrink-0 sticky top-0 z-10 border-b bg-background px-2 py-1 flex flex-wrap items-center gap-0.5">
        <ToolbarButton
          icon={<Bold className="h-3.5 w-3.5" />}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          tooltip="Bold (Ctrl+B)"
        />
        <ToolbarButton
          icon={<Italic className="h-3.5 w-3.5" />}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          tooltip="Italic (Ctrl+I)"
        />
        <ToolbarButton
          icon={<UnderlineIcon className="h-3.5 w-3.5" />}
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          tooltip="Underline (Ctrl+U)"
        />
        <ToolbarButton
          icon={<Strikethrough className="h-3.5 w-3.5" />}
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          tooltip="Strikethrough"
        />

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          icon={<Heading1 className="h-3.5 w-3.5" />}
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          tooltip="Heading 1"
        />
        <ToolbarButton
          icon={<Heading2 className="h-3.5 w-3.5" />}
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          tooltip="Heading 2"
        />
        <ToolbarButton
          icon={<Heading3 className="h-3.5 w-3.5" />}
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          tooltip="Heading 3"
        />

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          icon={<List className="h-3.5 w-3.5" />}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          tooltip="Bullet List"
        />
        <ToolbarButton
          icon={<ListOrdered className="h-3.5 w-3.5" />}
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          tooltip="Numbered List"
        />
        <ToolbarButton
          icon={<Quote className="h-3.5 w-3.5" />}
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          tooltip="Blockquote"
        />

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          icon={<Minus className="h-3.5 w-3.5" />}
          active={false}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          tooltip="Horizontal Rule"
        />

        {/* Link popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-7 w-7 ${editor.isActive("link") ? "bg-accent" : ""}`}
              title="Link"
            >
              <Link2 className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="flex gap-1">
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="h-7 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSetLink();
                }}
              />
              <Button size="sm" className="h-7 text-xs" onClick={handleSetLink}>
                Set
              </Button>
            </div>
            {editor.isActive("link") && (
              <div className="mt-1.5 flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px]"
                  onClick={() => {
                    const href = editor.getAttributes("link").href as string;
                    if (href) window.open(href, "_blank");
                  }}
                >
                  Open link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px]"
                  onClick={() => editor.chain().focus().unsetLink().run()}
                >
                  Remove link
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        <ToolbarButton
          icon={<ImageIcon className="h-3.5 w-3.5" />}
          active={false}
          onClick={handleImageUpload}
          tooltip="Upload Image"
        />

        <div className="mx-1 h-5 w-px bg-border" />

        {/* Inline code */}
        <ToolbarButton
          icon={<Code className="h-3.5 w-3.5" />}
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
          tooltip="Inline Code (Ctrl+E)"
        />

        {/* Code block with language selector */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-7 w-7 ${editor.isActive("codeBlock") ? "bg-accent" : ""}`}
              title="Code Block"
            >
              <FileCode2 className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-1" align="start">
            <div className="text-[10px] font-medium text-muted-foreground px-2 py-1">Language</div>
            {CODE_LANGUAGES.map((lang) => (
              <button
                key={lang.value}
                className="w-full rounded px-2 py-1 text-left text-xs hover:bg-accent"
                onClick={() => {
                  if (editor.isActive("codeBlock")) {
                    editor.chain().focus().updateAttributes("codeBlock", { language: lang.value }).run();
                  } else {
                    editor.chain().focus().toggleCodeBlock().run();
                    if (lang.value) {
                      editor.chain().focus().updateAttributes("codeBlock", { language: lang.value }).run();
                    }
                  }
                }}
              >
                {lang.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* LaTeX math */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-7 w-7 ${editor.isActive("inlineMath") || editor.isActive("blockMath") ? "bg-accent" : ""}`}
              title="Math (LaTeX)"
            >
              <Sigma className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1.5">
              <button
                className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent flex items-center gap-2"
                onClick={() => {
                  editor.chain().focus().insertInlineMath({ latex: "E=mc^2" }).run();
                }}
              >
                <span className="font-mono text-[10px] bg-muted px-1 rounded">$...$</span>
                <span>Inline math</span>
              </button>
              <button
                className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent flex items-center gap-2"
                onClick={() => {
                  editor.chain().focus().insertBlockMath({ latex: "\\sum_{i=1}^{n} x_i" }).run();
                }}
              >
                <span className="font-mono text-[10px] bg-muted px-1 rounded">$$...$$</span>
                <span>Block math</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="mx-1 h-5 w-px bg-border" />

        <ToolbarButton
          icon={<Undo2 className="h-3.5 w-3.5" />}
          active={false}
          onClick={() => editor.chain().focus().undo().run()}
          tooltip="Undo (Ctrl+Z)"
        />
        <ToolbarButton
          icon={<Redo2 className="h-3.5 w-3.5" />}
          active={false}
          onClick={() => editor.chain().focus().redo().run()}
          tooltip="Redo (Ctrl+Y)"
        />
      </div>

      {/* Persistent error banner */}
      {failCount >= 3 && (
        <div className="shrink-0 border-b bg-destructive/10 px-4 py-2 text-xs text-destructive flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          Auto-save is failing. Copy your work to be safe.
          <Button variant="outline" size="sm" className="ml-auto h-6 text-xs" onClick={doSave}>
            Save manually
          </Button>
        </div>
      )}

      {/* Editor content */}
      <div className="tiptap-editor flex-1 overflow-y-auto px-4 py-3">
        <EditorContent editor={editor} />
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 border-t px-4 py-1.5 flex items-center justify-between text-xs text-muted-foreground">
        <span>{wordCount} {wordCount === 1 ? "word" : "words"}</span>
        <div className="flex items-center gap-1.5">
          {saveStatus === "saving" && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Saving...</span>
            </>
          )}
          {saveStatus === "saved" && (
            <>
              <Check className="h-3 w-3" />
              <span>Saved</span>
            </>
          )}
          {saveStatus === "error" && failCount < 3 && (
            <button onClick={doSave} className="text-destructive hover:underline">
              Save failed — click to retry
            </button>
          )}
          {saveStatus === "idle" && (
            <button onClick={doSave} className="hover:underline">
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Toolbar Button ──────────────────────────────────────────────────────────

function ToolbarButton({
  icon,
  active,
  onClick,
  tooltip,
}: {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  tooltip: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`h-7 w-7 ${active ? "bg-accent" : ""}`}
      onClick={onClick}
      title={tooltip}
    >
      {icon}
    </Button>
  );
}
