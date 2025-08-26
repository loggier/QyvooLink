// This API route is no longer in use and has been replaced by a Server Action
// in `/src/app/(app)/dashboard/team/actions.ts`.
// The file is kept to avoid breaking changes if it was referenced elsewhere,
// but its content can be safely removed or ignored.

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    return NextResponse.json({ success: false, error: 'This API endpoint is deprecated. Please use the corresponding Server Action.' }, { status: 410 });
}
