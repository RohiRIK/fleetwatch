import { NextRequest, NextResponse } from 'next/server';
import { getRecommendations, getRecommendationStats, generateAllRecommendations } from '@/lib/services/recommendationGenerator';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const severity = searchParams.get('severity')?.split(',').filter(Boolean);
    const category = searchParams.get('category')?.split(',').filter(Boolean);
    const status = searchParams.get('status')?.split(',').filter(Boolean);
    const deviceId = searchParams.get('deviceId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const stats = searchParams.get('stats') === 'true';

    if (stats) {
      const recommendationStats = await getRecommendationStats();
      return NextResponse.json({ success: true, data: recommendationStats });
    }

    const { recommendations, total } = await getRecommendations({
      severity: severity as any[],
      category: category as any[],
      status: status as any[],
      deviceId,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: {
        recommendations,
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('Failed to fetch recommendations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, options } = body;

    if (action === 'generate') {
      const result = await generateAllRecommendations(options || {});
      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Failed to process recommendation request:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
