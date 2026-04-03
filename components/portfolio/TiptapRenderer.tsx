/**
 * Read-only Tiptap content renderer for public portfolio pages.
 *
 * Uses the same extensions as DiaryEditor (StarterKit, Underline, Link,
 * Image, CodeBlockLowlight, Mathematics) but with editable: false and no toolbar.
 */

"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { Mathematics } from "@tiptap/extension-mathematics";
import { common, createLowlight } from "lowlight";
import "katex/dist/katex.min.css";

const lowlight = createLowlight(common);

interface TiptapRendererProps {
  content: Record<string, unknown> | null;
  className?: string;
}

export function TiptapRenderer({ content, className }: TiptapRendererProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Underline,
      Link.configure({ autolink: false, openOnClick: true }),
      Image,
      CodeBlockLowlight.configure({ lowlight }),
      Mathematics.configure({
        katexOptions: { throwOnError: false },
      }),
    ],
    content: content ?? "",
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "tiptap-renderer prose prose-sm sm:prose max-w-none focus:outline-hidden",
      },
    },
  });

  if (!editor) return null;

  return (
    <div className={className}>
      <EditorContent editor={editor} />
    </div>
  );
}
