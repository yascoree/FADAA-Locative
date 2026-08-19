"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import styles from "./ui.module.css";

function ToolbarButton({ active, disabled, onClick, icon, title }) {
  return (
    <button
      type="button"
      className={`${styles.blogEditorToolBtn} ${active ? styles.blogEditorToolBtnActive : ""}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      <i className={`bi ${icon}`} />
    </button>
  );
}

/** Éditeur riche pour le corps d'un article de blog — Tiptap (StarterKit +
    Link + Image), sort du HTML sanitizé côté backend avant persistance (voir
    blog_post_service._sanitize). `onUploadImage(file)` doit renvoyer l'URL
    publique de l'image une fois uploadée (voir uploadBlogInlineImage). */
export default function BlogEditor({ content, onChange, onUploadImage, disabled }) {
  const fileInputRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: "noopener noreferrer" } }),
      Image,
    ],
    content: content || "",
    immediatelyRender: false,
    editable: !disabled,
    onUpdate: ({ editor: ed }) => onChange?.(ed.getHTML()),
  });

  useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) return null;

  function handleSetLink() {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL du lien", previousUrl || "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  async function handleImageChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onUploadImage) return;
    try {
      const url = await onUploadImage(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch {
      // L'appelant affiche déjà l'erreur via son propre banner d'état.
    }
  }

  return (
    <div className={styles.blogEditorWrap}>
      <div className={styles.blogEditorToolbar}>
        <ToolbarButton
          icon="bi-type-bold"
          title="Gras"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          icon="bi-type-italic"
          title="Italique"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          icon="bi-type-h2"
          title="Titre H2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton
          icon="bi-type-h3"
          title="Titre H3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        />
        <ToolbarButton
          icon="bi-list-ul"
          title="Liste à puces"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          icon="bi-list-ol"
          title="Liste numérotée"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          icon="bi-blockquote-left"
          title="Citation"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton icon="bi-link-45deg" title="Lien" active={editor.isActive("link")} onClick={handleSetLink} />
        <ToolbarButton icon="bi-image" title="Image" onClick={() => fileInputRef.current?.click()} />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={handleImageChange}
        />
        <ToolbarButton icon="bi-arrow-counterclockwise" title="Annuler" onClick={() => editor.chain().focus().undo().run()} />
        <ToolbarButton icon="bi-arrow-clockwise" title="Rétablir" onClick={() => editor.chain().focus().redo().run()} />
      </div>
      <EditorContent editor={editor} className={styles.blogEditorContent} />
    </div>
  );
}
