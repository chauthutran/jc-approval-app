import connectToDatabase from '@/libs/db/mongodb';
import OrgUnit from '@/libs/db/schemas/OrgUnitSchema';
import mongoose from 'mongoose';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        await connectToDatabase();

        const { searchParams } = request.nextUrl; // Extract query parameters
        const parentId = searchParams.get('parentId'); // Get "ou" value

        let orgUnits;
        if (!parentId) {
            /// Get the ROOT
            orgUnits = await OrgUnit.find({ parent: null }).sort({ name: 1 });
        } else {
            orgUnits = await OrgUnit.find({
                parent: new mongoose.Types.ObjectId(parentId),
            }).sort({ name: 1 });
        }

        // await db.disconnect();

        return Response.json(orgUnits, { status: 200 });
    } catch (error) {
        console.error('Error getting org units:', error);
        return Response.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        );
    }
}
