import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateSessionToken } from '@/lib/auth';

// POST /api/auth/logout - Clear session token
export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.headers.get('x-session-token');

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'No session token provided' },
        { status: 400 }
      );
    }

    if (!validateSessionToken(sessionToken)) {
      return NextResponse.json(
        { error: 'Invalid session token format' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Clear the session token
    const { error } = await supabase
      .from('users')
      .update({ session_token: null })
      .eq('session_token', sessionToken);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Logged out' });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
