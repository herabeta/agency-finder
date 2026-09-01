import { NextResponse } from 'next/server';
export async function GET(){
  return NextResponse.json({ok:true,service:'agency-finder',googlePlacesConfigured:Boolean(process.env.GOOGLE_MAPS_API_KEY),checkedAt:new Date().toISOString()});
}
