
import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/jwt';

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Public paths
    if (pathname === '/login' || pathname === '/api/login' || pathname.startsWith('/_next') || pathname.startsWith('/static') || pathname.includes('.')) {
        return NextResponse.next();
    }

    const token = req.cookies.get('token')?.value;

    const payload = token ? await verifyJWT(token) : null;

    if (!payload) {
        if (pathname.startsWith('/api')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const url = req.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    // If already logged in and visiting login page (handled by client redirect usually, but good to have)
    // Actually, we already allowed /login above. If we want to redirect logged in users away from login, we'd check token there.

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
