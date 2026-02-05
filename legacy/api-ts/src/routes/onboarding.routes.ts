import { Router, Request, Response } from 'express';
import { createOpenSearchClient, INDICES } from '../config/opensearch';

const router = Router();
const client = createOpenSearchClient();

// Helper to update the onboarding status document
async function updateOnboardingStatus(statusUpdate: any) {
  try {
    // Fetch existing status to merge
    let currentStatus: any = {
      key: 'onboarding_state',
      currentPhase: 'pending',
      progress: 0,
      steps: {},
      lastUpdated: new Date().toISOString(),
      error: null
    };

    try {
      const existingDoc = await client.get({
        index: INDICES.ONBOARDING_STATUS,
        id: 'onboarding_state'
      });
      currentStatus = existingDoc.body._source;
    } catch (error: any) {
      if (error.meta && error.meta.statusCode !== 404) {
        console.error('Failed to retrieve existing onboarding status:', error);
      }
      // If 404, currentStatus remains as the initial empty object
    }

    const mergedStatus = {
      ...currentStatus,
      ...statusUpdate,
      steps: {
        ...currentStatus.steps,
        ...statusUpdate.steps
      },
      lastUpdated: new Date().toISOString()
    };

    await client.index({
      index: INDICES.ONBOARDING_STATUS,
      id: 'onboarding_state',
      body: mergedStatus,
      refresh: true
    });
  } catch (error) {
    console.error('Failed to save onboarding status:', error);
  }
}

// POST endpoint to update onboarding progress
router.post('/onboarding/progress', async (req: Request, res: Response) => {
  const { phase, progress, steps, error } = req.body;

  if (!phase) {
    return res.status(400).json({ error: 'Missing phase in request body' });
  }

  try {
    const statusUpdate: any = { currentPhase: phase, progress: progress || 0 };
    if (steps) statusUpdate.steps = steps;
    if (error) statusUpdate.error = error;

    await updateOnboardingStatus(statusUpdate);
    res.json({ success: true, message: 'Onboarding status updated' });
  } catch (updateError) {
    console.error('Error updating onboarding status via API:', updateError);
    res.status(500).json({ error: 'Failed to update onboarding status' });
  }
});

// GET endpoint to retrieve onboarding status
router.get('/onboarding/status', async (req: Request, res: Response) => {
  try {
    const result = await client.get({
      index: INDICES.ONBOARDING_STATUS,
      id: 'onboarding_state'
    });
    res.json(result.body._source);
  } catch (error: any) {
    if (error.meta && error.meta.statusCode === 404) {
      res.json({ currentPhase: 'never_run', progress: 0, steps: {}, lastUpdated: new Date().toISOString(), error: null });
    } else {
      console.error('Error fetching onboarding status:', error);
      res.status(500).json({ error: 'Failed to fetch onboarding status' });
    }
  }
});

export const onboardingRoutes = router;
