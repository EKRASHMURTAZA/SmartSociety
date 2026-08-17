import { useEffect, useState } from "react";
import { Camera, Save, UserRound } from "lucide-react";
import { useApp } from "../state/store";
import type { Profile, Role } from "../data/mock";
import { Avatar, Button, Field, Modal, TextInput } from "./ui";
import { api } from "../lib/api";

interface ProfileEditorProps {
  role: Role;
  open: boolean;
  onClose: () => void;
}

export function ProfileEditor({ role, open, onClose }: ProfileEditorProps) {
  const { profiles, updateProfile, toast } = useApp();
  const profile: Profile = profiles[role];
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(profile.name);
    setPhone(profile.phone);
    setEmail(profile.email);
    setAvatar(profile.avatar);
    setAvatarFile(null);
    setSaving(false);
  }, [open, profile]);

  const onPhotoChange = (file?: File) => {
    if (!file) return;
    if (!["image/jpeg","image/png","image/webp"].includes(file.type)) { toast("Only JPG, PNG or WebP images are allowed.", "warning"); return; }
    if (file.size > 5 * 1024 * 1024) { toast("Profile photo must be 5 MB or smaller.", "warning"); return; }
    setAvatarFile(file);
    setAvatar(URL.createObjectURL(file));
  };

  const save = async () => {
    const cleanName = name.trim(), cleanPhone = phone.trim(), cleanEmail = email.trim();
    if (!cleanName || !cleanPhone || !cleanEmail) { toast("Please complete your profile details.", "warning"); return; }
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) { toast("Enter a valid email address.", "warning"); return; }
    if (cleanPhone.replace(/\D/g, "").length < 10) { toast("Enter a valid phone number.", "warning"); return; }
    setSaving(true);
    try {
      let avatarUrl = profile.avatar;
      if (avatarFile) avatarUrl = (await api.uploadImage("profiles", avatarFile)).url;
      await updateProfile(role, { name: cleanName, phone: cleanPhone, email: cleanEmail, avatar: avatarUrl });
      onClose(); toast("Profile updated successfully.", "success");
    } catch (e) { toast(e instanceof Error ? e.message : "Unable to update profile.", "danger"); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit profile" subtitle="Update your contact details and profile photo.">
      <div className="space-y-5">
        <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
          <Avatar src={avatar} alt={name || profile.name} size="lg" ring />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-800">Profile photo</p>
            <p className="mt-0.5 text-xs text-slate-500">JPG, PNG or WebP · maximum 5 MB.</p>
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-surface px-3 py-2 text-sm font-semibold">
              <Camera className="h-4 w-4" /> Choose photo
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => onPhotoChange(e.target.files?.[0])} />
            </label>
          </div>
        </div>
        <Field label="Full name"><TextInput value={name} onChange={e=>setName(e.target.value)} /></Field>
        <Field label="Phone"><TextInput value={phone} onChange={e=>setPhone(e.target.value)} /></Field>
        <Field label="Email"><TextInput type="email" value={email} onChange={e=>setEmail(e.target.value)} /></Field>
        <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-500"><UserRound className="inline h-4 w-4 mr-2 text-brand-600"/>Role and society assignment are controlled by the system.</div>
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-100 bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="flex-1" onClick={save} disabled={saving}><Save className="h-4 w-4"/>{saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>
    </Modal>
  );
}
