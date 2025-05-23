import connectToDatabase from '@/libs/db/mongodb';
import DataValue from '@/libs/db/schemas/DataValueSchema';
import OrgUnit from '@/libs/db/schemas/OrgUnitSchema';
import mongoose from 'mongoose';

export async function POST(request: Request) {
    try {
        const {
            periods: periodCodes,
            dataElements: dataElementIds,
            orgUnitLevel,
            orgUnit: orgUnitId,
        } = await request.json(); // Get request body

        if (!periodCodes && !dataElementIds && !orgUnitLevel && !orgUnitId) {
            return Response.json(
                { message: 'Missing required fields' },
                { status: 500 },
            );
        }

        const dataElementIdObjs = dataElementIds.map(
            (deId: string) => new mongoose.Types.ObjectId(deId),
        );

        await connectToDatabase();

        const dataValues = await OrgUnit.aggregate([
            // Step 1: Find the org unit and its descendants at the given level
            {
                $match: { _id: new mongoose.Types.ObjectId(orgUnitId) },
            },
            {
                $graphLookup: {
                    from: 'orgunits',
                    startWith: '$_id',
                    connectFromField: '_id',
                    connectToField: 'parent',
                    as: 'descendants',
                },
            },
            {
                $unwind: '$descendants',
            },
            {
                $match: { 'descendants.level': orgUnitLevel },
            },
            {
                $replaceRoot: { newRoot: '$descendants' },
            },

            // Step 2: Join with DataValue collection
            {
                $lookup: {
                    from: 'datavalues', // Match with DataValue collection
                    localField: '_id', // orgUnit._id from previous step
                    foreignField: 'orgUnit', // orgUnit field in DataValue
                    as: 'dataValues',
                },
            },
            {
                $unwind: '$dataValues',
            },

            // Step 3: Filter by dataElements and periods
            {
                $lookup: {
                    from: 'periods',
                    localField: 'dataValues.period',
                    foreignField: '_id',
                    as: 'periodDetails',
                },
            },
            {
                $unwind: '$periodDetails',
            },
            {
                $match: {
                    'periodDetails.code': { $in: periodCodes }, // Filter by period codes
                    'dataValues.dataElement': { $in: dataElementIdObjs }, // Filter by data elements
                },
            },
            // Step 4: Lookup dataElements to get additional info
            {
                $lookup: {
                    from: 'dataelements',
                    localField: 'dataValues.dataElement',
                    foreignField: '_id',
                    as: 'dataElementDetails',
                },
            },
            {
                $unwind: '$dataElementDetails',
            },
            // Step 5: Return only necessary fields
            {
                $project: {
                    _id: '$dataValues._id',
                    orgUnit: '$_id',
                    orgUnitName: '$name',
                    dataElement: {
                        _id: '$dataElementDetails._id',
                        name: '$dataElementDetails.name',
                        description: '$dataElementDetails.description',
                    },
                    period: {
                        _id: '$dataValues.period',
                        code: '$periodDetails.code',
                        name: '$periodDetails.name',
                    },
                    value: '$dataValues.value',
                },
            },
        ]);

        return Response.json(dataValues, { status: 200 });
    } catch (error: any) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}
