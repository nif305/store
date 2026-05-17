import { Role, Status, TrainingRoomBookingStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { SessionUser } from '@/lib/auth/session';

const DEFAULT_ROOMS = [
  ['قاعة التدريب 1', 'قاعة تدريبية', 24, 'صفوف تدريبية, طاولات دائرية', 'شاشة, بروجكتر, سبورة'],
  ['قاعة التدريب 2', 'قاعة تدريبية', 24, 'صفوف تدريبية, طاولات دائرية', 'شاشة, بروجكتر, سبورة'],
  ['قاعة التدريب 3', 'قاعة تدريبية', 30, 'صفوف تدريبية, ورشة تطبيقية', 'شاشة, بروجكتر, سبورة'],
  ['قاعة التدريب 4', 'قاعة تدريبية', 30, 'صفوف تدريبية, ورشة تطبيقية', 'شاشة, بروجكتر, سبورة'],
  ['قاعة التدريب 5', 'قاعة تدريبية', 35, 'طاولات دائرية, ورشة تطبيقية', 'شاشة, صوتيات, سبورة'],
  ['قاعة التدريب 6', 'قاعة تدريبية', 35, 'طاولات دائرية, ورشة تطبيقية', 'شاشة, صوتيات, سبورة'],
  ['قاعة التدريب 7', 'قاعة تدريبية', 40, 'صفوف تدريبية, طاولات دائرية', 'شاشة, بروجكتر, مايكروفون'],
  ['قاعة التدريب 8', 'قاعة تدريبية', 40, 'صفوف تدريبية, طاولات دائرية', 'شاشة, بروجكتر, مايكروفون'],
  ['معمل الحاسب 1', 'معمل حاسب', 25, 'معمل أجهزة', '25 جهاز, شاشة, شبكة, بروجكتر'],
  ['معمل الحاسب 2', 'معمل حاسب', 25, 'معمل أجهزة', '25 جهاز, شاشة, شبكة, بروجكتر'],
  ['معمل الحاسب 3', 'معمل حاسب', 30, 'معمل أجهزة', '30 جهاز, شاشة, شبكة, بروجكتر'],
  ['معمل الأمن السيبراني', 'معمل حاسب', 24, 'معمل أجهزة, ورشة تطبيقية', 'أجهزة, شبكة تدريب, شاشة'],
  ['قاعة ورش العمل 1', 'ورشة تطبيقية', 28, 'طاولات دائرية, ورشة تطبيقية', 'شاشة, ألواح, أدوات ورش'],
  ['قاعة ورش العمل 2', 'ورشة تطبيقية', 28, 'طاولات دائرية, ورشة تطبيقية', 'شاشة, ألواح, أدوات ورش'],
  ['قاعة الاجتماعات التدريبية', 'قاعة اجتماعات', 20, 'اجتماع, طاولات دائرية', 'شاشة, كاميرا, صوتيات'],
  ['قاعة المحاكاة', 'قاعة محاكاة', 22, 'محاكاة, ورشة تطبيقية', 'شاشات, أدوات محاكاة, صوتيات'],
  ['المسرح التدريبي', 'مسرح', 120, 'مسرح, محاضرة', 'منصة, صوتيات, شاشة كبيرة'],
  ['قاعة المحاضرات الكبرى', 'قاعة كبرى', 80, 'محاضرة, صفوف تدريبية', 'شاشة كبيرة, صوتيات, منصة'],
  ['النادي الرياضي', 'نشاط رياضي', 50, 'نشاط رياضي', 'مساحة مفتوحة, أدوات نشاط'],
  ['قاعة الأنشطة', 'نشاط تدريبي', 45, 'نشاط جماعي, طاولات دائرية', 'مساحة مرنة, شاشة'],
  ['قاعة القيادات', 'قاعة تنفيذية', 18, 'اجتماع, طاولات دائرية', 'شاشة, ضيافة, صوتيات'],
  ['قاعة التدريب المرن', 'قاعة مرنة', 32, 'صفوف تدريبية, طاولات دائرية, ورشة تطبيقية', 'شاشة, أثاث مرن'],
  ['قاعة العروض التطبيقية', 'قاعة تطبيقية', 36, 'عرض تطبيقي, ورشة تطبيقية', 'شاشة, صوتيات, مساحة عرض'],
] as const;

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(normalizeText).filter(Boolean);
  return String(value || '')
    .split(',')
    .map(normalizeText)
    .filter(Boolean);
}

function normalizeDate(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function publicRoomImageUrl(id: string) {
  return `/api/training-rooms/image?id=${encodeURIComponent(id)}`;
}

function parseImageDataUrl(value?: string | null) {
  const imageUrl = normalizeText(value);
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl) || imageUrl.startsWith('/')) {
    return { redirectUrl: imageUrl, contentType: null, bytes: null };
  }
  const match = imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return {
    redirectUrl: null,
    contentType: match[1],
    bytes: Buffer.from(match[2], 'base64'),
  };
}

export function canManageRooms(session: Pick<SessionUser, 'role' | 'canManageTrainerNeeds'>) {
  const roles = (session as Partial<Pick<SessionUser, 'roles'>>).roles || [];
  return session.role === Role.MANAGER || session.role === Role.WAREHOUSE || roles.includes(Role.MANAGER) || roles.includes(Role.WAREHOUSE) || !!session.canManageTrainerNeeds;
}

export function canAdminRooms(session: Pick<SessionUser, 'role'>) {
  const roles = (session as Partial<Pick<SessionUser, 'roles'>>).roles || [];
  return session.role === Role.MANAGER || session.role === Role.WAREHOUSE || roles.includes(Role.MANAGER) || roles.includes(Role.WAREHOUSE);
}

export async function ensureTrainingRoomsSeed() {
  const count = await prisma.trainingRoom.count();
  if (count > 0) return;

  await prisma.trainingRoom.createMany({
    data: DEFAULT_ROOMS.map(([name, type, capacity, layouts, equipment], index) => ({
      name,
      type,
      capacity,
      layoutOptions: normalizeList(layouts),
      equipment: normalizeList(equipment),
      isVisible: true,
      sortOrder: index,
      description: `${type} بسعة ${capacity} متدرب.`,
    })),
  });
}

export async function roomAvailabilityMap(startDate?: Date | null, endDate?: Date | null) {
  if (!startDate || !endDate) return new Map<string, number>();
  const bookings = await prisma.trainingRoomBooking.findMany({
    where: {
      status: TrainingRoomBookingStatus.APPROVED,
      approvedRoomId: { not: null },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { approvedRoomId: true },
  });
  const map = new Map<string, number>();
  for (const booking of bookings) {
    if (!booking.approvedRoomId) continue;
    map.set(booking.approvedRoomId, (map.get(booking.approvedRoomId) || 0) + 1);
  }
  return map;
}

type RoomAvailabilityRequest = {
  roomId: string;
  startDate: Date;
  endDate: Date;
};

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart <= bEnd && aEnd >= bStart;
}

export async function findApprovedRoomConflicts(selections: RoomAvailabilityRequest[], excludeTrainerNeedId?: string) {
  const validSelections = selections.filter((selection) => selection.roomId && selection.startDate && selection.endDate);
  if (!validSelections.length) return [];

  const roomIds = Array.from(new Set(validSelections.map((selection) => selection.roomId)));
  const minStart = new Date(Math.min(...validSelections.map((selection) => selection.startDate.getTime())));
  const maxEnd = new Date(Math.max(...validSelections.map((selection) => selection.endDate.getTime())));

  const bookings = await prisma.trainingRoomBooking.findMany({
    where: {
      status: TrainingRoomBookingStatus.APPROVED,
      approvedRoomId: { in: roomIds },
      startDate: { lte: maxEnd },
      endDate: { gte: minStart },
      ...(excludeTrainerNeedId ? { trainerNeedId: { not: excludeTrainerNeedId } } : {}),
    },
    include: {
      approvedRoom: { select: { id: true, name: true } },
      trainerNeed: { select: { id: true, code: true, courseName: true } },
    },
  });

  return bookings.filter((booking) =>
    validSelections.some((selection) =>
      selection.roomId === booking.approvedRoomId &&
      overlaps(selection.startDate, selection.endDate, booking.startDate, booking.endDate)
    )
  );
}

export async function assertRoomsAvailable(selections: RoomAvailabilityRequest[], excludeTrainerNeedId?: string) {
  const conflicts = await findApprovedRoomConflicts(selections, excludeTrainerNeedId);
  if (!conflicts.length) return;
  const roomName = conflicts[0].approvedRoom?.name || 'القاعة المحددة';
  const courseName = conflicts[0].trainerNeed?.courseName || conflicts[0].trainerNeed?.code || 'دورة أخرى';
  throw new Error(`${roomName} محجوزة في نفس الفترة لدورة ${courseName}. اختر قاعة بديلة أو عدل التواريخ.`);
}

function mapRoom(room: any, bookedMap: Map<string, number>, options: { publicPayload?: boolean } = {}) {
  return {
    id: room.id,
    name: room.name,
    type: room.type,
    capacity: room.capacity,
    location: room.location,
    description: room.description,
    equipment: room.equipment || [],
    layoutOptions: room.layoutOptions || [],
    imageUrl: options.publicPayload ? publicRoomImageUrl(room.id) : room.imageUrl,
    isVisible: room.isVisible,
    sortOrder: room.sortOrder,
    internalNotes: room.internalNotes,
    isAvailable: !(bookedMap.get(room.id) || 0),
  };
}

export async function getPublicRooms(params: { startDate?: unknown; endDate?: unknown; traineeCount?: unknown } = {}) {
  await ensureTrainingRoomsSeed();
  const startDate = normalizeDate(params.startDate);
  const endDate = normalizeDate(params.endDate);
  const traineeCount = Math.max(0, Number(params.traineeCount || 0));
  const bookedMap = await roomAvailabilityMap(startDate, endDate);
  const rooms = await prisma.trainingRoom.findMany({
    where: { isVisible: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  const mapped = rooms.map((room) => ({
    ...mapRoom(room, bookedMap, { publicPayload: true }),
    capacityFit: traineeCount ? room.capacity >= traineeCount : true,
  }));
  return {
    rooms: mapped,
    types: Array.from(new Set(mapped.map((room) => room.type))).sort((a, b) => a.localeCompare(b, 'ar')),
  };
}

export async function getRoomsAdminCatalog() {
  await ensureTrainingRoomsSeed();
  const bookedMap = await roomAvailabilityMap(new Date(), new Date());
  const rooms = await prisma.trainingRoom.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  return { rooms: rooms.map((room) => mapRoom(room, bookedMap)) };
}

export async function getPublicRoomImage(id: string) {
  const roomId = normalizeText(id);
  if (!roomId) return null;
  const room = await prisma.trainingRoom.findFirst({
    where: { id: roomId, isVisible: true },
    select: { imageUrl: true },
  });
  return parseImageDataUrl(room?.imageUrl);
}

export async function updateTrainingRoom(id: string, data: any) {
  return prisma.trainingRoom.update({
    where: { id },
    data: {
      name: normalizeText(data.name) || undefined,
      type: normalizeText(data.type) || undefined,
      capacity: Number.isFinite(Number(data.capacity)) ? Math.max(1, Number(data.capacity)) : undefined,
      location: normalizeText(data.location) || null,
      description: normalizeText(data.description) || null,
      equipment: Array.isArray(data.equipment) || typeof data.equipment === 'string' ? normalizeList(data.equipment) : undefined,
      layoutOptions: Array.isArray(data.layoutOptions) || typeof data.layoutOptions === 'string' ? normalizeList(data.layoutOptions) : undefined,
      imageUrl: normalizeText(data.imageUrl || data.imageDataUrl) || null,
      isVisible: typeof data.isVisible === 'boolean' ? data.isVisible : undefined,
      sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : undefined,
      internalNotes: normalizeText(data.internalNotes) || null,
    },
  });
}

export async function createTrainingRoom(data: any) {
  const name = normalizeText(data.name);
  if (!name) throw new Error('اسم القاعة مطلوب');
  return prisma.trainingRoom.create({
    data: {
      name,
      type: normalizeText(data.type) || 'قاعة تدريبية',
      capacity: Math.max(1, Number(data.capacity || 20)),
      location: normalizeText(data.location) || null,
      description: normalizeText(data.description) || null,
      equipment: normalizeList(data.equipment),
      layoutOptions: normalizeList(data.layoutOptions),
      imageUrl: normalizeText(data.imageUrl || data.imageDataUrl) || null,
      isVisible: typeof data.isVisible === 'boolean' ? data.isVisible : true,
      sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : 1000,
      internalNotes: normalizeText(data.internalNotes) || null,
    },
  });
}

export async function listRoomBookings() {
  await ensureTrainingRoomsSeed();
  return prisma.trainingRoomBooking.findMany({
    include: {
      requestedRoom: true,
      approvedRoom: true,
      trainerNeed: { include: { assignedTo: { select: { id: true, fullName: true } } } },
    },
    orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
    take: 200,
  });
}

export async function approveRoomBooking(needId: string, roomId: string, session: SessionUser, note?: string) {
  const need = await prisma.trainerNeed.findUnique({ where: { id: needId }, include: { roomBooking: true } });
  if (!need) throw new Error('طلب المدرب غير موجود');
  const room = await prisma.trainingRoom.findUnique({ where: { id: roomId } });
  if (!room) throw new Error('القاعة غير موجودة');
  const startDate = need.startDate;
  const endDate = need.endDate || need.startDate;
  await assertRoomsAvailable([{ roomId, startDate, endDate }], needId);

  return prisma.trainingRoomBooking.upsert({
    where: { trainerNeedId: needId },
    update: {
      approvedRoomId: roomId,
      status: TrainingRoomBookingStatus.APPROVED,
      coordinatorNote: normalizeText(note) || null,
      approvedById: session.id,
      approvedAt: new Date(),
    },
    create: {
      trainerNeedId: needId,
      requestedRoomId: roomId,
      approvedRoomId: roomId,
      startDate,
      endDate,
      status: TrainingRoomBookingStatus.APPROVED,
      coordinatorNote: normalizeText(note) || null,
      approvedById: session.id,
      approvedAt: new Date(),
    },
    include: { requestedRoom: true, approvedRoom: true },
  });
}

export async function cancelRoomBooking(needId: string, note?: string) {
  return prisma.trainingRoomBooking.update({
    where: { trainerNeedId: needId },
    data: {
      status: TrainingRoomBookingStatus.CANCELLED,
      coordinatorNote: normalizeText(note) || null,
    },
  });
}
