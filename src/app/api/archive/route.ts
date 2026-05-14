import { NextRequest, NextResponse } from 'next/server';
import {
  ArchiveService,
  type ArchiveFolderKey,
  type ArchiveSource,
} from '@/services/archive.service';
import { isManager, resolveSessionUser } from '@/lib/auth/session';

const SOURCE_FOLDERS: Record<ArchiveSource, ArchiveFolderKey[]> = {
  materials: [
    'material-consumable',
    'material-returnable',
    'material-custody-returned',
  ],
};

function resolveFolder(
  source: ArchiveSource,
  requestedFolder: string | null
): ArchiveFolderKey {
  const folders = SOURCE_FOLDERS[source];
  const normalized = String(requestedFolder || '').trim() as ArchiveFolderKey;
  return folders.includes(normalized) ? normalized : folders[0];
}

function resolveStatus(error: unknown) {
  const message = String((error as { message?: string })?.message || '');

  if (
    message.includes('تسجيل الدخول') ||
    message.includes('الحساب') ||
    message.includes('المستخدم الحالي')
  ) {
    return 401;
  }

  return 500;
}

export async function GET(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    if (!isManager(session)) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 403 });
    }

    const source: ArchiveSource = 'materials';
    const folder = resolveFolder(
      source,
      request.nextUrl.searchParams.get('folder')
    );
    const pageParam = Number(request.nextUrl.searchParams.get('page') || 1);
    const limitParam = Number(request.nextUrl.searchParams.get('limit') || 5);
    const search = request.nextUrl.searchParams.get('search');

    const result = await ArchiveService.getFolderData({
      source,
      folder,
      page: Number.isFinite(pageParam) ? pageParam : 1,
      limit: Number.isFinite(limitParam) ? limitParam : 5,
      search,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error as { message?: string })?.message || 'تعذر جلب الأرشيف' },
      { status: resolveStatus(error) }
    );
  }
}
