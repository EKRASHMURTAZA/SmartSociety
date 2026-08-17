import { useEffect, useCallback, useMemo, useState } from "react";
import {
  ArrowUpDown,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Droplets,
  Eye,
  MapPin,
  Megaphone,
  MoreHorizontal,
  PartyPopper,
  Plus,
  ShieldAlert,
  Siren,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Wrench,
  Zap,
} from "lucide-react";
import { cn } from "../utils/cn";
import { generateReference } from "../utils/generate";
import { useApp } from "../state/store";
import { api } from "../lib/api";
import {
  complaintCategories,
  type Complaint,
  type ComplaintStatus,
  type Notice,
  type Profile,
} from "../data/mock";
import { IMG } from "../data/mock";
import { Avatar, Badge, Button, Card, EmptyState, Field, ImgWithFallback, Modal, ModalFooter, PageHeader, SectionTitle, Tabs, TextArea, TextInput } from "../components/ui";
import { usePoll } from "../lib/usePoll";

/* ------------------------------------------------------------ Complaint UI */
const statusMeta: Record<
  ComplaintStatus,
  {
    label: string;
    tone: "success" | "warning" | "danger" | "info" | "neutral";
  }
> = {
  submitted: { label: "Pending", tone: "info" },
  assigned: { label: "Pending", tone: "warning" },
  "in-progress": { label: "In Progress", tone: "warning" },
  resolved: { label: "Resolved", tone: "success" },
};

const statusOrder: ComplaintStatus[] = [
  "submitted",
  "assigned",
  "in-progress",
  "resolved",
];

function ComplaintTimeline({ status }: { status: ComplaintStatus }) {
  const idx = statusOrder.indexOf(status);

  return (
    <div className="flex items-start gap-1.5">
      {statusOrder.map((s, i) => (
        <div key={s} className="flex min-w-0 flex-1 items-start gap-1.5">
          <div className="flex min-w-[58px] flex-col items-center gap-1 text-center">
            {i <= idx ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
                <CheckCircle2 className="h-3 w-3" />
              </span>
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-200 bg-surface">
                <Circle className="h-2 w-2 text-slate-300" />
              </span>
            )}
            <span
              className={cn(
                "text-[10px] font-semibold leading-tight",
                i <= idx ? "text-brand-700" : "text-slate-400"
              )}
            >
              {s === "submitted"
                ? "Pending"
                : s === "assigned"
                  ? "Assigned"
                  : s === "in-progress"
                    ? "In Progress"
                    : "Resolved"}
            </span>
          </div>

          {i < statusOrder.length - 1 && (
            <div
              className={cn(
                "mt-2.5 h-0.5 flex-1 rounded-full",
                i < idx ? "bg-brand-500" : "bg-slate-200"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

const catIcons: Record<string, typeof Droplets> = {
  Droplets,
  Zap,
  Sparkles,
  ArrowUpDown,
  ShieldAlert,
  MoreHorizontal,
};

export function ResidentComplaints() {
  const { complaints, addComplaint, toast } = useApp();
  const [stage, setStage] = useState<"pick" | "form" | "done">("pick");
  const [category, setCategory] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [created, setCreated] = useState<Complaint | null>(null);
  const [selectedComplaint, setSelectedComplaint] =
    useState<Complaint | null>(null);

  const reset = () => {
    setStage("pick");
    setCategory(null);
    setTitle("");
    setDesc("");
    setPhoto(null);
    setPhotoName("");
    setPhotoFile(null);
    setCreated(null);
  };

  const selectCategory = (value: string) => {
    setCategory(value);
    setStage("form");
  };

  const handlePhoto = (file: File | undefined) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast("Please select an image file.", "warning");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast("Please choose an image smaller than 5 MB.", "warning");
      return;
    }

    if (photo) {
      URL.revokeObjectURL(photo);
    }

    setPhoto(URL.createObjectURL(file));
    setPhotoName(file.name);
    setPhotoFile(file);
  };

  const submit = async () => {
    if (!category) {
      toast("Please select a complaint category.", "warning");
      return;
    }

    if (!desc.trim()) {
      toast("Please describe the problem.", "warning");
      return;
    }

    let photoUrl: string | null = null;
    try {
      if (photoFile) photoUrl = (await api.uploadImage("complaints", photoFile)).url;
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to upload complaint photo.", "danger");
      return;
    }

    const c: Complaint = {
      id: generateReference("complaint"),
      number: `#${generateReference("C").slice(-8).toUpperCase()}`,
      category,
      title: title.trim() || desc.trim().slice(0, 40),
      description: desc.trim(),
      status: "submitted",
      createdAt: "Just now",
      photo: photoUrl,
    };

    try {
      const createdComplaint = await addComplaint(c);
      setCreated(createdComplaint);
      setStage("done");
      toast("Complaint submitted.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to submit complaint", "danger");
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Complaints"
        subtitle="Tell us what's wrong — we'll track it until it's fixed."
      />

      {stage === "pick" && (
        <section className="animate-fade-in space-y-8">
          <div>
            <SectionTitle>What do you need help with?</SectionTitle>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {complaintCategories.map((c) => {
                const Icon = catIcons[c.icon];

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectCategory(c.id)}
                    className="group flex flex-col items-center gap-3 rounded-2xl border border-slate-200/80 bg-surface p-5 text-center shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift cursor-pointer"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-500 transition-colors group-hover:bg-brand-50 group-hover:text-brand-600">
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="text-sm font-bold text-slate-800">
                      {c.id}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <SectionTitle>My complaints</SectionTitle>
              {complaints.length > 0 && (
                <span className="text-xs font-semibold text-slate-400">
                  {complaints.length} total
                </span>
              )}
            </div>

            {complaints.length === 0 ? (
              <EmptyState
                icon={<Wrench className="h-7 w-7" />}
                title="No complaints yet"
                message="Report a maintenance or society issue and track its progress here."
              />
            ) : (
              <div className="space-y-3">
                {complaints.map((c) => (
                  <Card key={c.id} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="neutral">{c.category}</Badge>
                          <span className="text-xs font-medium text-slate-400">
                            {c.number} · {c.createdAt}
                          </span>
                        </div>

                        <p className="mt-2 font-bold text-slate-900">
                          {c.title}
                        </p>

                        <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">
                          {c.description}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {c.assignedTo && (
                            <span className="text-xs font-semibold text-brand-700">
                              Assigned to {c.assignedTo}
                            </span>
                          )}

                          {c.photo && (
                            <span className="text-xs font-medium text-slate-400">
                              Photo attached
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge tone={statusMeta[c.status].tone}>
                          {statusMeta[c.status].label}
                        </Badge>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedComplaint(c)}
                        >
                          View details
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <ComplaintTimeline status={c.status} />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {stage === "form" && category && (
        <Card className="animate-slide-up mx-auto max-w-xl p-6 sm:p-8">
          <button
            type="button"
            onClick={reset}
            className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <ChevronRight className="h-4 w-4 rotate-180" /> Back
          </button>

          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              {(() => {
                const Icon =
                  catIcons[
                    complaintCategories.find((c) => c.id === category)
                      ?.icon ?? "MoreHorizontal"
                  ];

                return <Icon className="h-5 w-5" />;
              })()}
            </span>

            <div>
              <h2 className="text-lg font-bold">{category}</h2>
              <p className="text-xs text-slate-400">
                Tell us what happened
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <Field label="Short title (optional)">
              <TextInput
                placeholder={`e.g. ${category} issue in my flat`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
              />
            </Field>

            <Field
              label="Describe the problem"
              hint="Please include the location and what is happening."
            >
              <TextArea
                placeholder="Example: The kitchen sink tap has been dripping since morning and water is pooling under the sink…"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={6}
                maxLength={1000}
              />
            </Field>

            <Field
              label="Add a photo (optional)"
              hint="JPG, PNG or WebP · Maximum 5 MB"
            >
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/30">
                {photo ? (
                  <>
                    <img
                      src={photo}
                      alt="Complaint upload preview"
                      className="max-h-48 rounded-xl object-cover"
                    />
                    <span className="max-w-full truncate text-xs font-medium text-slate-500">
                      {photoName}
                    </span>
                    <span className="text-xs font-semibold text-brand-700">
                      Choose a different photo
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-600">
                      Tap to upload a photo
                    </span>
                  </>
                )}

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => handlePhoto(e.target.files?.[0])}
                />
              </label>
            </Field>

            <ModalFooter>
              <div className="flex gap-3 pt-1">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={reset}
                >
                  Cancel
                </Button>

                <Button
                  className="flex-[2]"
                  size="lg"
                  onClick={submit}
                  disabled={!desc.trim()}
                >
                  <Wrench className="h-4 w-4" />
                  Submit complaint
                </Button>
              </div>
            </ModalFooter>
          </div>
        </Card>
      )}

      {stage === "done" && created && (
        <Card className="animate-pop-in mx-auto max-w-xl p-6 text-center sm:p-10">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </span>

          <h2 className="mt-4 text-xl font-extrabold">
            Complaint {created.number} submitted
          </h2>

          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            {created.category} · "{created.description.slice(0, 70)}
            {created.description.length > 70 ? "…" : ""}"
          </p>

          <div className="mt-7 rounded-2xl bg-slate-50 p-5">
            <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">
              What happens next
            </p>
            <ComplaintTimeline status="submitted" />
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button variant="secondary" onClick={reset}>
              Report another issue
            </Button>
            <Button onClick={reset}>Done</Button>
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(selectedComplaint)}
        onClose={() => setSelectedComplaint(null)}
        title={
          selectedComplaint
            ? `Complaint ${selectedComplaint.number}`
            : "Complaint details"
        }
      >
        {selectedComplaint && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{selectedComplaint.category}</Badge>
              <Badge tone={statusMeta[selectedComplaint.status].tone}>
                {statusMeta[selectedComplaint.status].label}
              </Badge>
              <span className="text-xs font-medium text-slate-400">
                {selectedComplaint.createdAt}
              </span>
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                {selectedComplaint.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                {selectedComplaint.description}
              </p>
            </div>

            {selectedComplaint.photo && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Attached photo
                </p>
                <img
                  src={selectedComplaint.photo}
                  alt="Complaint attachment"
                  className="max-h-72 w-full rounded-2xl object-cover"
                />
              </div>
            )}

            {selectedComplaint.assignedTo && (
              <div className="rounded-2xl bg-brand-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
                  Assigned staff
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {selectedComplaint.assignedTo}
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-slate-100 bg-surface p-4">
              <p className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-400">
                Progress
              </p>
              <ComplaintTimeline status={selectedComplaint.status} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* -------------------------------------------------------------- Amenities */
const AMENITY_SLOTS = ["09:00–11:00", "11:30–13:30", "15:00–17:00", "17:00–19:00", "19:30–21:30"] as const;

const AMENITY_IMAGES: Record<string, string> = {
  "Clubhouse": IMG.clubhouse,
  "Swimming Pool": IMG.pool,
  "Sports Court": IMG.sports,
  "Party Hall": IMG.partyHall,
};

const formatTime12 = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
};

const formatSlotLabel = (value: string) => {
  const [start, end] = value.split("–");
  return `${formatTime12(start)} – ${formatTime12(end)}`;
};

export function ResidentAmenities() {
  const { bookings, addBooking, toast } = useApp();
  const [amenityCatalog, setAmenityCatalog] = useState<Awaited<ReturnType<typeof api.amenities>>>([]);
  const [catalogError, setCatalogError] = useState("");
  const [bookAmenity, setBookAmenity] = useState<string | null>(null);
  const [dateISO, setDateISO] = useState("");
  const [slot, setSlot] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [bookingDraft, setBookingDraft] = useState<{ date: string; slot: string } | null>(null);

  useEffect(() => {
    api
      .amenities()
      .then((rows) => {
        setAmenityCatalog(rows);
        setCatalogError("");
      })
      .catch(() => setCatalogError("Unable to load amenities. Please try again."));
  }, []);

  usePoll(() => {
    if (bookAmenity) return;
    api
      .amenities()
      .then((rows) => {
        setAmenityCatalog(rows);
        setCatalogError("");
      })
      .catch(() => undefined);
  }, 30000);

  const bookingDates = useMemo(() => {
    const base = new Date();
    return [0, 1, 2].map((offset) => {
      const d = new Date(base);
      d.setDate(base.getDate() + offset);
      return {
        iso: d.toISOString().slice(0, 10),
        label:
          offset === 0
            ? "Today"
            : offset === 1
              ? "Tomorrow"
              : d.toLocaleDateString("en-PK", { weekday: "short", day: "2-digit", month: "short" }),
      };
    });
  }, []);

  const amenity = amenityCatalog.find((a) => a.id === bookAmenity);

  const amenitySlots: string[] =
    amenity && amenity.slots.length > 0
      ? amenity.slots.map((s: { startTime: string; endTime: string }) => `${s.startTime}–${s.endTime}`)
      : [...AMENITY_SLOTS];

  const getDateLabel = (iso: string) =>
    bookingDates.find((d) => d.iso === iso)?.label ??
    new Date(iso).toLocaleDateString("en-PK", { weekday: "short", day: "2-digit", month: "short" });

  const isSlotBooked = (amenityName: string, bookingDateISO: string, bookingSlot: string) =>
    bookings.some(
      (booking) =>
        booking.amenity === amenityName &&
        booking.dateISO === bookingDateISO &&
        booking.slot === bookingSlot &&
        booking.status === "confirmed"
    );

  const availableSlots = amenity
    ? amenitySlots.filter((candidate) => !isSlotBooked(amenity.name, dateISO, candidate))
    : [];

  const selectDate = (nextDateISO: string) => {
    setDateISO(nextDateISO);
    setSlot("");
  };

  const confirmBooking = async () => {
    if (!amenity) {
      toast("Please select an amenity first.", "warning");
      return;
    }

    if (!slot) {
      toast("Please pick an available time slot.", "warning");
      return;
    }

    if (isSlotBooked(amenity.name, dateISO, slot)) {
      toast("That slot has just been booked. Please choose another time.", "warning");
      setSlot("");
      return;
    }

    try {
      await addBooking({
        id: `b-${Date.now()}`,
        amenity: amenity.name,
        date: dateISO,
        dateISO,
        slot,
        status: "confirmed",
      });
      setBookingDraft({ date: dateISO, slot });
      setConfirmed(true);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to confirm booking", "danger");
    }
  };

  const closeModal = () => {
    setBookAmenity(null);
    setSlot("");
    setDateISO(bookingDates[1]?.iso ?? "");
    setConfirmed(false);
    setBookingDraft(null);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Amenities"
        subtitle="See what's available and reserve a facility in a few simple steps."
      />

      {catalogError ? (
        <Card className="px-5 py-8 text-center text-sm text-rose-600">{catalogError}</Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {amenityCatalog.map((amenityItem) => {
            const cardDateISO = bookingDates[1]?.iso ?? "";
            const freeCount = amenityItem.slots.length > 0
              ? amenityItem.slots.filter(
                  (candidate: { startTime: string; endTime: string }) => !isSlotBooked(amenityItem.name, cardDateISO, `${candidate.startTime}–${candidate.endTime}`)
                ).length
              : 0;

            return (
              <Card key={amenityItem.id} className="overflow-hidden">
                <div className="relative h-48">
                  <ImgWithFallback
                    src={AMENITY_IMAGES[amenityItem.name] ?? IMG.clubhouse}
                    alt={amenityItem.name}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#020617]/70 to-transparent p-4 pt-10">
                    <Badge tone="brand" className="bg-surface/95 backdrop-blur">
                      {amenityItem.tag}
                    </Badge>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-slate-900">
                        {amenityItem.name}
                      </h3>
                      <p className="mt-0.5 text-xs font-semibold text-slate-400">
                        {amenityItem.price}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-xs font-bold text-emerald-600">
                        {amenityItem.slots.length} slots daily
                      </p>
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="h-3 w-3" />
                        {amenityItem.hours}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-slate-500">
                    {amenityItem.description}
                  </p>

                  <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5">
                    <span className="text-xs font-semibold text-slate-500">
                      {freeCount} slots available
                    </span>
                    <span className="text-xs font-medium text-slate-400">
                      {bookingDates[1]?.label ?? "Tomorrow"}
                    </span>
                  </div>

                  <Button
                    className="mt-4 w-full"
                    onClick={() => setBookAmenity(amenityItem.id)}
                  >
                    <CalendarCheck className="h-4 w-4" /> Book Now
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <section>
        <div className="flex items-center justify-between gap-3">
          <SectionTitle>My bookings</SectionTitle>
          {bookings.length > 0 && (
            <span className="text-xs font-semibold text-slate-400">
              {bookings.length} total
            </span>
          )}
        </div>

        {bookings.length === 0 ? (
          <EmptyState
            icon={<CalendarCheck className="h-7 w-7" />}
            title="No bookings yet"
            message="Book the clubhouse, pool or party hall — your reservation will appear here."
          />
        ) : (
          <div className="space-y-3">
            {bookings.map((booking) => (
              <Card
                key={booking.id}
                className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                    <CalendarDays className="h-5 w-5" />
                  </span>

                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{booking.amenity}</p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {booking.date} · {formatSlotLabel(booking.slot)}
                    </p>
                  </div>
                </div>

                <Badge
                  tone={
                    booking.status === "confirmed" ? "success" : "warning"
                  }
                >
                  {booking.status === "confirmed" ? "Confirmed" : "Pending"}
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={Boolean(amenity)}
        onClose={closeModal}
        title={`Book ${amenity?.name ?? ""}`}
        subtitle="Choose a date, then select one of the available time slots."
      >
        {amenity && (
          <div className="space-y-5">
            {confirmed ? (
              <div className="flex flex-col items-center py-4 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-8 w-8" />
                </span>

                <h3 className="mt-4 text-xl font-extrabold text-slate-900">
                  Booking confirmed
                </h3>

                <p className="mt-1 max-w-xs text-sm leading-relaxed text-slate-500">
                  {amenity.name} · {getDateLabel(bookingDraft?.date ?? dateISO)} ·{" "}
                  {formatSlotLabel(bookingDraft?.slot ?? slot)}
                </p>

                <div className="mt-5 w-full rounded-2xl bg-slate-50 p-4 text-left">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Reservation
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400">
                        Facility
                      </p>
                      <p className="text-sm font-bold text-slate-800">
                        {amenity.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400">
                        Time
                      </p>
                      <p className="text-sm font-bold text-slate-800">
                        {formatSlotLabel(bookingDraft?.slot ?? slot)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400">
                        Date
                      </p>
                      <p className="text-sm font-bold text-slate-800">
                        {getDateLabel(bookingDraft?.date ?? dateISO)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400">
                        Status
                      </p>
                      <p className="text-sm font-bold text-emerald-600">
                        Confirmed
                      </p>
                    </div>
                  </div>
                </div>

                <Button className="mt-6 w-full" variant="secondary" onClick={closeModal}>
                  Done
                </Button>
              </div>
            ) : (
              <>
                <Field label="Date">
                  <div className="grid grid-cols-3 gap-2">
                    {bookingDates.map((candidateDate) => (
                      <button
                        key={candidateDate.iso}
                        type="button"
                        onClick={() => selectDate(candidateDate.iso)}
                        className={cn(
                          "rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all cursor-pointer",
                          dateISO === candidateDate.iso
                            ? "border-brand-500 bg-brand-50 text-brand-700"
                            : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        {candidateDate.label}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Available time slots">
                  {availableSlots.length === 0 ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-sm font-bold text-amber-800">
                        No slots available for this date.
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-amber-700">
                        Choose another date to continue with your booking.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {amenitySlots.map((candidateSlot) => {
                        const available = availableSlots.includes(candidateSlot);

                        return (
                          <button
                            key={candidateSlot}
                            type="button"
                            disabled={!available}
                            onClick={() => setSlot(candidateSlot)}
                            className={cn(
                              "rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition-all",
                              !available &&
                                "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300",
                              available &&
                                slot === candidateSlot &&
                                "border-brand-500 bg-brand-50 text-brand-700 cursor-pointer",
                              available &&
                                slot !== candidateSlot &&
                                "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
                            )}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span>{formatSlotLabel(candidateSlot)}</span>
                              {!available && (
                                <span className="text-[10px] font-bold uppercase tracking-wide">
                                  Full
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Field>

                <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                  <p className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-brand-600" />
                    Facility hours: {amenity.hours}
                  </p>
                  <p className="mt-1.5 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-brand-600" />
                    {amenity.price}
                  </p>
                </div>

                <ModalFooter>
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={confirmBooking}
                    disabled={!slot || availableSlots.length === 0}
                  >
                    <CalendarCheck className="h-4 w-4" />
                    Confirm booking
                  </Button>
                </ModalFooter>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* -------------------------------------------------------------- Community */
const HIGHLIGHT_DOTS: Record<string, string> = {
  "Important": "bg-rose-500",
  "Update": "bg-sky-500",
  "Event": "bg-violet-500",
  "Emergency": "bg-rose-500",
};

function MiniCalendar({ notices: noticeList }: { notices: Notice[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthLabel = now.toLocaleDateString("en-PK", { month: "long", year: "numeric" });
  const startDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const highlights: Record<number, { dot: string; label: string }> = {};
  noticeList.forEach((notice) => {
    const day = Number.parseInt(notice.date, 10);
    if (Number.isFinite(day) && day >= 1 && day <= daysInMonth && !highlights[day]) {
      highlights[day] = {
        dot: HIGHLIGHT_DOTS[notice.emergency ? "Emergency" : notice.tag] ?? "bg-brand-500",
        label: notice.title,
      };
    }
  });

  const today = now.getDate();

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-bold">{monthLabel}</p>
        <Badge tone="brand">Society calendar</Badge>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-400">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1 text-center">
        {Array.from({ length: startDay }).map((_, index) => (
          <span key={`empty-${index}`} />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const highlight = highlights[day];
          const isToday = day === today;

          return (
            <div
              key={day}
              className={cn(
                "relative flex h-9 items-center justify-center rounded-lg text-xs font-semibold",
                isToday ? "bg-brand-600 text-white" : "text-slate-600"
              )}
              title={highlight?.label}
            >
              {day}
              {highlight && (
                <span
                  className={cn(
                    "absolute bottom-1 h-1 w-1 rounded-full",
                    highlight.dot
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
        {Object.entries(highlights).length === 0 ? (
          <p className="text-xs text-slate-400">No notices this month.</p>
        ) : (
          Object.entries(highlights).map(([day, highlight]) => (
            <p
              key={day}
              className="flex items-center gap-2 text-xs text-slate-500"
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  highlight.dot
                )}
              />
              <span className="font-bold text-slate-700">{day}</span>
              <span>— {highlight.label}</span>
            </p>
          ))
        )}
      </div>
    </Card>
  );
}

export function ResidentCommunity() {
  const [tab, setTab] = useState<
    "notices" | "events" | "polls" | "calendar"
  >("notices");
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const { toast, notices, polls, votePoll } = useApp();

  const eventNotices = useMemo(
    () => notices.filter((notice) => notice.tag === "Event"),
    [notices]
  );

  const eventImages = [IMG.garden, IMG.walk, IMG.family];

  const vote = async (pollId: string, optionId: string) => {
    try {
      await votePoll(pollId, optionId);
      toast("Vote recorded. Thank you!", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to record your vote", "danger");
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Community"
        subtitle="What's happening around Maple Heights."
      />

      <Tabs
        items={[
          { id: "notices", label: "Notices" },
          { id: "events", label: "Events" },
          { id: "polls", label: "Polls" },
          { id: "calendar", label: "Calendar" },
        ]}
        value={tab}
        onChange={setTab}
        className="max-w-md"
      />

      {tab === "notices" && (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-3">
            {notices.length === 0 ? (
              <EmptyState
                icon={<Megaphone className="h-7 w-7" />}
                title="No notices yet"
                message="New society announcements will appear here."
              />
            ) : (
              notices.map((notice) => (
                <Card
                  key={notice.id}
                  className={cn(
                    "flex items-start gap-4 p-5",
                    notice.emergency && "border-rose-200 bg-rose-50/40"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      notice.emergency
                        ? "bg-rose-100 text-rose-600"
                        : notice.tag === "Important"
                          ? "bg-amber-50 text-amber-600"
                          : "bg-brand-50 text-brand-600"
                    )}
                  >
                    {notice.emergency ? (
                      <Siren className="h-5 w-5" />
                    ) : (
                      <Megaphone className="h-5 w-5" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={
                          notice.emergency
                            ? "danger"
                            : notice.tag === "Important"
                              ? "warning"
                              : notice.tag === "Event"
                                ? "brand"
                                : "info"
                        }
                      >
                        {notice.emergency ? "Emergency" : notice.tag}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {notice.date}
                      </span>
                    </div>

                    <p className="mt-1.5 font-bold text-slate-900">
                      {notice.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm leading-relaxed text-slate-500">
                      {notice.body}
                    </p>

                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-3"
                      onClick={() => setSelectedNotice(notice)}
                    >
                      <Eye className="h-3.5 w-3.5" /> View details
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>

          <MiniCalendar notices={notices} />
        </div>
      )}

      {tab === "events" && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {eventNotices.length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <EmptyState
                icon={<PartyPopper className="h-7 w-7" />}
                title="No upcoming events"
                message="Society events and activities will appear here."
              />
            </div>
          ) : (
            eventNotices.map((event, index) => (
              <Card key={event.id} className="overflow-hidden">
                <div className="relative h-40">
                  <ImgWithFallback
                    src={eventImages[index % eventImages.length]}
                    alt={event.title}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute left-3 top-3 rounded-xl bg-surface/95 px-3 py-1.5 text-center shadow-soft backdrop-blur">
                    <p className="text-xs font-extrabold text-brand-700">
                      {event.date}
                    </p>
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="brand">Event</Badge>
                  </div>

                  <h3 className="mt-2 font-bold text-slate-900">
                    {event.title}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-500">
                    {event.body}
                  </p>

                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-4 w-full"
                    onClick={() => setSelectedNotice(event)}
                  >
                    <Eye className="h-3.5 w-3.5" /> View details
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === "polls" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {polls.length === 0 ? (
            <div className="lg:col-span-2">
              <EmptyState
                icon={<Megaphone className="h-7 w-7" />}
                title="No active polls"
                message="Community polls will appear here when the society committee publishes one."
              />
            </div>
          ) : (
            polls.map((poll) => {
              const totalVotes = poll.options.reduce((sum, option) => sum + option.votes, 0);
              const hasVoted = poll.myVote !== null;

              return (
                <Card key={poll.id} className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Badge tone="brand">Community poll</Badge>
                      <p className="mt-3 font-bold leading-relaxed text-slate-900">
                        {poll.question}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    {poll.options.map((option) => {
                      const voted = poll.myVote === option.id;
                      const percentage = Math.round(
                        (option.votes / (totalVotes || 1)) * 100
                      );

                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={hasVoted}
                          onClick={() => vote(poll.id, option.id)}
                          className={cn(
                            "relative w-full overflow-hidden rounded-xl border px-4 py-3 text-left transition-all",
                            hasVoted
                              ? "cursor-default"
                              : "cursor-pointer hover:border-slate-300",
                            voted
                              ? "border-brand-500 bg-brand-50"
                              : "border-slate-200"
                          )}
                        >
                          {hasVoted && (
                            <span
                              className="absolute inset-y-0 left-0 bg-brand-100/70 transition-all duration-700"
                              style={{ width: `${percentage}%` }}
                            />
                          )}

                          <span className="relative flex items-center justify-between gap-3">
                            <span
                              className={cn(
                                "text-sm font-semibold",
                                voted
                                  ? "text-brand-800"
                                  : "text-slate-700"
                              )}
                            >
                              {option.label}
                            </span>
                            {hasVoted && (
                              <span className="text-xs font-extrabold text-slate-600">
                                {percentage}%
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-3 text-xs text-slate-400">
                    {hasVoted
                      ? `${totalVotes} votes · your vote has been recorded`
                      : `${totalVotes} votes · choose one option`}
                  </p>
                </Card>
              );
            })
          )}
        </div>
      )}

      {tab === "calendar" && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <MiniCalendar notices={notices} />

          <div className="space-y-3">
            <SectionTitle>Upcoming events</SectionTitle>

            {eventNotices.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="h-7 w-7" />}
                title="Nothing scheduled"
                message="Upcoming community activity will appear here."
              />
            ) : (
              eventNotices.map((event) => (
                <Card key={event.id} className="flex items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900">{event.title}</p>
                    <p className="text-xs text-slate-500">
                      {event.date}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setSelectedNotice(event)}
                  >
                    <Eye className="h-3.5 w-3.5" /> View
                  </Button>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      <Modal
        open={Boolean(selectedNotice)}
        onClose={() => setSelectedNotice(null)}
        title={selectedNotice?.title ?? "Notice details"}
        subtitle={
          selectedNotice
            ? `${selectedNotice.date} · ${selectedNotice.emergency ? "Emergency notice" : selectedNotice.tag}`
            : undefined
        }
      >
        {selectedNotice && (
          <div className="space-y-5">
            <div
              className={cn(
                "rounded-2xl p-4",
                selectedNotice.emergency
                  ? "bg-rose-50 text-rose-900"
                  : "bg-slate-50 text-slate-700"
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    selectedNotice.emergency
                      ? "bg-rose-100 text-rose-600"
                      : "bg-surface text-brand-600"
                  )}
                >
                  {selectedNotice.emergency ? (
                    <Siren className="h-5 w-5" />
                  ) : (
                    <Megaphone className="h-5 w-5" />
                  )}
                </span>
                <p className="text-sm leading-6">{selectedNotice.body}</p>
              </div>
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setSelectedNotice(null)}
            >
              Close
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ---------------------------------------------------------------- Profile */
const SECTION_ACTIONS: Record<string, "vehicle" | "household" | "contact"> = {
  "Vehicle": "vehicle",
  "Household": "household",
  "Emergency contacts": "contact",
};

const EMPTY_FORM = { label: "", number: "", name: "", relation: "", note: "", phone: "" };

export function ResidentProfile() {
  const { role, profiles, user, updateProfile, refreshProfile, toast } = useApp();
  const p = profiles[role];
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(user?.name ?? p.name);
  const [phone, setPhone] = useState(user?.phone ?? p.phone);
  const [email, setEmail] = useState(user?.email ?? p.email);
  const [saving, setSaving] = useState(false);
  const [rawProfile, setRawProfile] = useState<any>(null);
  const [addKind, setAddKind] = useState<"vehicle" | "household" | "contact" | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);

  const loadRaw = useCallback(async () => {
    try {
      setRawProfile(await api.profile());
    } catch {
      setRawProfile(null);
    }
  }, []);

  useEffect(() => {
    void loadRaw();
  }, [loadRaw]);

  const saveProfile = async () => {
    if (!name.trim() || !phone.trim() || !email.trim()) {
      toast("Please complete your profile details", "warning");
      return;
    }

    setSaving(true);
    try {
      await updateProfile(role, { name: name.trim(), phone: phone.trim(), email: email.trim() });
      setEditOpen(false);
      toast("Profile details saved", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to save profile", "danger");
    } finally {
      setSaving(false);
    }
  };

  const rawRows = (kind: "vehicle" | "household" | "contact") => {
    if (!rawProfile) return [];
    if (kind === "vehicle") return rawProfile.vehicles ?? [];
    if (kind === "household") return rawProfile.household ?? [];
    return rawProfile.emergencyContacts ?? [];
  };

  const removeRow = async (kind: "vehicle" | "household" | "contact", id: string) => {
    try {
      if (kind === "vehicle") await api.removeVehicle(id);
      else if (kind === "household") await api.removeHousehold(id);
      else await api.removeContact(id);
      await Promise.all([refreshProfile(), loadRaw()]);
      toast("Entry removed", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to remove entry", "danger");
    }
  };

  const submitAdd = async () => {
    if (!addKind) return;

    if (addKind === "vehicle" && (!form.label.trim() || !form.number.trim())) {
      toast("Please enter the vehicle label and number", "warning");
      return;
    }
    if (addKind === "household" && (!form.name.trim() || !form.relation.trim())) {
      toast("Please enter the member name and relation", "warning");
      return;
    }
    if (addKind === "contact" && (!form.label.trim() || !form.phone.trim())) {
      toast("Please enter the contact label and phone number", "warning");
      return;
    }

    setAdding(true);
    try {
      if (addKind === "vehicle") await api.addVehicle(form.label.trim(), form.number.trim());
      else if (addKind === "household") await api.addHousehold({ name: form.name.trim(), relation: form.relation.trim(), note: form.note.trim() || undefined });
      else await api.addContact(form.label.trim(), form.phone.trim());
      await Promise.all([refreshProfile(), loadRaw()]);
      setAddKind(null);
      setForm(EMPTY_FORM);
      toast("Added to your profile", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Unable to add entry", "danger");
    } finally {
      setAdding(false);
    }
  };

  const renderSectionCard = (section: NonNullable<Profile["sections"]>[number]) => {
    const kind = SECTION_ACTIONS[section.heading];
    const rows = kind ? rawRows(kind) : [];

    return (
      <Card key={section.heading} className="p-6">
        <div className="flex items-center justify-between gap-3">
          <SectionTitle>{section.heading}</SectionTitle>
          {kind && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAddKind(kind)}
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          )}
        </div>
        {section.rows.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">Nothing added yet.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {section.rows.map((r, index) => {
              const rowId = rows[index]?.id;
              return (
                <div
                  key={`${r.label}-${index}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700">{r.label}</p>
                    <p className="text-sm text-slate-400">{r.value}</p>
                  </div>
                  {rowId && kind && (
                    <button
                      type="button"
                      aria-label={`Remove ${r.label}`}
                      onClick={() => removeRow(kind, rowId)}
                      className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        subtitle="Your personal details, household, vehicles and emergency contacts."
      />

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.65fr]">
        <div className="space-y-6">
          <Card className="p-7 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <Avatar src={user?.avatar ?? p.avatar} alt={user?.name ?? p.name} size="2xl" ring />
              <h2 className="mt-4 text-xl font-extrabold text-slate-900">{user?.name ?? p.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{p.title}</p>
              <p className="mt-1 text-xs text-slate-400">{p.society}</p>
              <Button
                variant="secondary"
                className="mt-5"
                onClick={() => setEditOpen(true)}
              >
                <UserRound className="h-4 w-4" /> Edit profile
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <SectionTitle>Flat & membership</SectionTitle>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4 border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                <span className="text-sm text-slate-400">Flat</span>
                <span className="text-right text-sm font-bold text-slate-800">
                  {user?.flat ? `${user.flat.tower}-${user.flat.number}` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                <span className="text-sm text-slate-400">Membership</span>
                <span className="text-right text-sm font-bold text-slate-800">Active</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <SectionTitle>Personal information</SectionTitle>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50/70 p-4">
                <p className="text-xs font-semibold text-slate-400">Full name</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{user?.name ?? name}</p>
              </div>
              <div className="rounded-2xl bg-slate-50/70 p-4">
                <p className="text-xs font-semibold text-slate-400">Phone</p>
                <p className="mt-1 text-sm font-bold text-slate-800">{user?.phone ?? phone}</p>
              </div>
              <div className="rounded-2xl bg-slate-50/70 p-4 sm:col-span-2">
                <p className="text-xs font-semibold text-slate-400">Email</p>
                <p className="mt-1 break-words text-sm font-bold text-slate-800">{user?.email ?? email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setName(user?.name ?? p.name);
                setPhone(user?.phone ?? p.phone);
                setEmail(user?.email ?? p.email);
                setEditOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand-700 hover:text-brand-800"
            >
              Update contact details <ChevronRight className="h-4 w-4" />
            </button>
          </Card>

          {p.sections?.map((section) => renderSectionCard(section))}
        </div>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit profile"
        subtitle="Keep your contact details up to date for society communication."
      >
        <div className="space-y-5">
          <Field label="Full name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Phone">
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Email">
            <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <ModalFooter>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={saveProfile} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </ModalFooter>
        </div>
      </Modal>

      <Modal
        open={Boolean(addKind)}
        onClose={() => {
          setAddKind(null);
          setForm(EMPTY_FORM);
        }}
        title={
          addKind === "vehicle"
            ? "Add a vehicle"
            : addKind === "household"
              ? "Add a household member"
              : "Add an emergency contact"
        }
        subtitle="This entry is saved to your society profile."
      >
        <div className="space-y-5">
          {addKind === "vehicle" && (
            <>
              <Field label="Vehicle type">
                <TextInput placeholder="e.g. Car, Bike" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </Field>
              <Field label="Registration number">
                <TextInput placeholder="e.g. LEB-1234" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} />
              </Field>
            </>
          )}

          {addKind === "household" && (
            <>
              <Field label="Full name">
                <TextInput placeholder="e.g. Priya Mehta" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Relation">
                <TextInput placeholder="e.g. Spouse, Son" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} />
              </Field>
              <Field label="Note (optional)">
                <TextInput placeholder="e.g. 9 yrs" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </Field>
            </>
          )}

          {addKind === "contact" && (
            <>
              <Field label="Label">
                <TextInput placeholder="e.g. Emergency, Work" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </Field>
              <Field label="Phone number">
                <TextInput placeholder="e.g. +92 3XX XXXXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
            </>
          )}

          <ModalFooter>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setAddKind(null)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={submitAdd} disabled={adding}>
                {adding ? "Saving…" : "Add entry"}
              </Button>
            </div>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
}