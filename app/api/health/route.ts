import { NextResponse } from 'next/server';
export async function GET(){return NextResponse.json({ok:true, googlePlacesConfigured:Boolean(process.env.GOOGLE_MAPS_API_KEY)});}
