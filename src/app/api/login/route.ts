
import { NextRequest, NextResponse } from 'next/server';
import { signJWT } from '@/lib/jwt';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
    try {
        const { username, password } = await req.json();

        const APP_USERNAME = process.env.APP_USERNAME;
        const APP_PASSWORD = process.env.APP_PASSWORD;

        if (!APP_USERNAME || !APP_PASSWORD) {
            return NextResponse.json({ error: 'Server misconfiguration: credentials not set' }, { status: 500 });
        }

        if (username === APP_USERNAME && password === APP_PASSWORD) {
            const token = await signJWT({ username });

            const response = NextResponse.json({ message: 'Login successful' });

            response.cookies.set('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 60 * 60 * 24 * 30, // 30 days
                path: '/',
            });

            return response;
        }

        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    } catch (error) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
