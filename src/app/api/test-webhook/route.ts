import { NextRequest, NextResponse } from 'next/server';
import { storeWebhookPayload } from '@/lib/services/webhook-playground';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = Object.fromEntries(request.headers.entries());

    console.log('Test Webhook Received:', {
      timestamp: new Date().toISOString(),
      body,
    });

    await storeWebhookPayload({
      payload: body,
      headers,
      method: 'POST',
      url: request.url,
      status: 'success',
      response: {
        success: true,
        message: 'Webhook received successfully',
        receivedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook received successfully',
      receivedAt: new Date().toISOString(),
      payload: body,
    });
  } catch (error) {
    console.error('Test Webhook Error:', error);

    try {
      await storeWebhookPayload({
        payload: { error: error instanceof Error ? error.message : 'Unknown error' },
        headers: Object.fromEntries(request.headers.entries()),
        method: 'POST',
        url: request.url,
        status: 'error',
        response: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    } catch (dbError) {
      console.error('Failed to store error in database:', dbError);
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to process webhook',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Test webhook endpoint is working!',
    usage: 'Send a POST request to this endpoint with your webhook payload',
    examplePayload: {
      event: 'website_changed',
      website: { name: 'Example Site', url: 'https://example.com' },
      change: {
        detectedAt: new Date().toISOString(),
        changeType: 'content_modified',
      },
    },
  });
}
