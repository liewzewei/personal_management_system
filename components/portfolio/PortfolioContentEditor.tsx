/**
 * Rich text editor for portfolio admin panel.
 *
 * Mirrors the same Tiptap extensions and toolbar as DiaryEditor but with
 * controlled props (content, onChange) instead of diary-specific auto-save.
 * Used for editing project descriptions and blog post bodies.
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
  Code,
  FileCode2,
  Sigma,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const lowlight = createLowlight(common);

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

interface PortfolioContentEditorProps {
  content: Record<string, unknown> | null;
  onChange: (json: Record<string, unknown>, plainText: string) => void;
  uploadEndpoint?: string;
  placeholder?: string;
}

function ToolbarButton({
  onClick,
  isActive,
  children,
  title,
}: {
  onClick: () => void;
  isActive?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        isActive
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

export function PortfolioContentEditor({
  content,
  onChange,
  uploadEndpoint = "/api/portfolio/admin/upload",
  placeholder = "Write your content...",
}: PortfolioContentEditorProps) {
  const [linkUrl, setLinkUrl] = useState("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Underline,
      Link.configure({ autolink: true, openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder }),
      CharacterCount,
      CodeBlockLowlight.configure({ lowlight }),
      Mathematics.configure({
        katexOptions: { throwOnError: false },
      }),
      CodeBlockTabHandler,
    ],
    content: content ?? "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-hidden min-h-[300px] px-1",
      },
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON() as Record<string, unknown>;
      const text = ed.getText();
      onChangeRef.current(json, text);
    },
    immediatelyRender: false,
  });

  // Sync external content changes
  const initialContentSet = useRef(false);
  useEffect(() => {
    if (editor && content && !initialContentSet.current) {
      initialContentSet.current = true;
    }
  }, [editor, content]);

  const handleImageUpload = useCallback(async () => {
    if (!editor) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/gif,image/webp";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        alert("Image too large. Max 10MB.");
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch(uploadEndpoint, { method: "POST", body: formData });
        const body = (await res.json()) as { data: string | null; error: string | null };
        if (body.data) {
          editor.chain().focus().setImage({ src: body.data }).run();
        }
      } catch {
        alert("Failed to upload image");
      }
    };
    input.click();
  }, [editor, uploadEndpoint]);

  const handleSetLink = useCallback(() => {
    if (!editor || !linkUrl) return;
    if (linkUrl === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run();
    }
    setLinkUrl("");
  }, [editor, linkUrl]);

  const handleInsertMath = useCallback(
    (type: "inline" | "block") => {
      if (!editor) return;
      if (type === "inline") {
        editor.chain().focus().insertContent({ type: "inlineMath", attrs: { latex: "x^2" } }).run();
      } else {
        editor.chain().focus().insertContent({ type: "math", attrs: { latex: "\\sum_{i=0}^n x_i" } }).run();
      }
    },
    [editor]
  );

  if (!editor) return null;

  const iconSize = 16;
  const wordCount = editor.storage.characterCount?.words() ?? 0;

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 border-b bg-muted/30">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} title="Bold">
          <Bold size={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} title="Italic">
          <Italic size={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive("underline")} title="Underline">
          <UnderlineIcon size={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive("strike")} title="Strikethrough">
          <Strikethrough size={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive("code")} title="Inline Code">
          <Code size={iconSize} />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive("heading", { level: 1 })} title="Heading 1">
          <Heading1 size={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive("heading", { level: 2 })} title="Heading 2">
          <Heading2 size={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive("heading", { level: 3 })} title="Heading 3">
          <Heading3 size={iconSize} />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} title="Bullet List">
          <List size={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} title="Ordered List">
          <ListOrdered size={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive("blockquote")} title="Blockquote">
          <Quote size={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Rule">
          <Minus size={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive("codeBlock")} title="Code Block">
          <FileCode2 size={iconSize} />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Link popover */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`p-1.5 rounded transition-colors ${
                editor.isActive("link")
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              title="Insert Link"
            >
              <Link2 size={iconSize} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <div className="flex gap-1">
              <Input
                placeholder="https://..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSetLink()}
                className="h-8 text-xs"
              />
              <Button size="sm" className="h-8 px-2" onClick={handleSetLink}>
                Set
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <ToolbarButton onClick={handleImageUpload} title="Upload Image">
          <ImageIcon size={iconSize} />
        </ToolbarButton>

        {/* Math */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="p-1.5 rounded transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
              title="Insert Math"
            >
              <Sigma size={iconSize} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="flex flex-col gap-1">
              <Button size="sm" variant="ghost" className="justify-start text-xs" onClick={() => handleInsertMath("inline")}>
                Inline Math
              </Button>
              <Button size="sm" variant="ghost" className="justify-start text-xs" onClick={() => handleInsertMath("block")}>
                Block Math
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <Undo2 size={iconSize} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <Redo2 size={iconSize} />
        </ToolbarButton>

        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {wordCount} words
        </span>
      </div>

      {/* Editor content */}
      <div className="p-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
