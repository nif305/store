import { NextRequest, NextResponse } from 'next/server';
import { getPublicRoomImage } from '@/services/training-rooms.service';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') || '';
  const image = await getPublicRoomImage(id);

  if (!image) {
    return new NextResponse(null, { status: 404 });
  }

  if (image.redirectUrl) {
    return NextResponse.redirect(image.redirectUrl);
  }

  return new NextResponse(image.bytes, {
    headers: {
      'Content-Type': image.contentType || 'image/png',
      'Cache-Control': 'no-cache, max-age=0, must-revalidate',
    },
  });
}
