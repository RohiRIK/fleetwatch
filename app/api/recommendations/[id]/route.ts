import { NextRequest, NextResponse } from 'next/server';
import { acknowledgeRecommendation, resolveRecommendation, dismissRecommendation } from '@/lib/services/recommendationGenerator';
import { db } from '@/lib/db/drizzle';
import { fleetRecommendations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const recommendation = await db.query.fleetRecommendations.findFirst({
      where: eq(fleetRecommendations.id, id),
    });

    if (!recommendation) {
      return NextResponse.json(
        { success: false, error: 'Recommendation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: recommendation,
    });
  } catch (error) {
    console.error('Failed to fetch recommendation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch recommendation' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'acknowledge':
        await acknowledgeRecommendation(id);
        break;
      case 'resolve':
        await resolveRecommendation(id);
        break;
      case 'dismiss':
        await dismissRecommendation(id);
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message: `Recommendation ${action} successful`,
    });
  } catch (error) {
    console.error('Failed to update recommendation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update recommendation' },
      { status: 500 }
    );
  }
}
