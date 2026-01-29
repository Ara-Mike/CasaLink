# Rooms Collection Field Mapping

## ✅ Issue Resolved

**Problem:** Code was looking for `apartmentUnits` collection, but your collection is named `rooms`

**Solution:** Updated DataManager to query `rooms` collection and automatically map fields

---

## Field Mapping (Automatic Conversion)

Your Firestore `rooms` collection fields are automatically converted to unit format:

| Firestore Field | App Uses As | Purpose |
|---|---|---|
| `roomNumber` | `unitNumber` + `roomNumber` | Unique identifier (e.g., "1A") |
| `floor` | `floor` | Building floor (converted to number if string) |
| `isAvailable` | `status` | Becomes "vacant" if true, "occupied" if false |
| `occupiedBy` | `occupiedBy` | Tenant user ID |
| `numberOfMembers` | `numberOfMembers` | Current occupants |
| `maxMembers` | `maxMembers` | Room capacity |
| `monthlyRent` | `monthlyRent` | Rent amount |
| `numberOfBedrooms` | `numberOfBedrooms` | Bedroom count |
| `numberOfBathrooms` | `numberOfBathrooms` | Bathroom count |
| `occupiedAt` | `occupiedAt` | Occupancy date |
| `createdAt` | `createdAt` | Room creation date |
| `updatedAt` | `updatedAt` | Last update date |

---

## How It Works

### 1. **Initial Load** (`getLandlordUnits`)
```javascript
// Queries rooms collection and transforms data:
rooms collection → mapped units → dashboard display
```

### 2. **Real-Time Updates** (`getUnitsWithRealtimeUpdates`)
```javascript
// Listens to entire rooms collection (no landlordId filter needed)
rooms collection (all) → snapshot received → mapped units → callback
```

### 3. **Field Transformation**
```javascript
// Example: Raw room document
{
  roomNumber: "1A",
  floor: "1",          // Note: stored as string
  isAvailable: false,
  occupiedBy: "Xu0J0XSyg3Rbo5b03hwKWOawUvv1"
}

// Automatically becomes:
{
  roomNumber: "1A",
  unitNumber: "1A",    // Added for compatibility
  floor: 1,            // Converted to number
  status: "occupied",  // Mapped from isAvailable
  occupiedBy: "Xu0J0XSyg3Rbo5b03hwKWOawUvv1",
  // ... plus all original fields
}
```

---

## Status Values

The app displays unit status based on `isAvailable` field:

| isAvailable | Status | Color | Icon |
|---|---|---|---|
| `true` | Vacant | Green | Empty |
| `false` | Occupied | Blue | Occupied |

---

## Floor Handling

Since your `floor` field is stored as a string (e.g., `"1"`), the code automatically converts it to a number for sorting:

```javascript
const floor = parseInt(room.floor) || room.floor;
// "1" → 1
// "2" → 2
// etc.
```

---

## Real-Time Updates

**Before:** Queried `apartmentUnits` with `landlordId` filter (no data)  
**After:** Listens to entire `rooms` collection (gets all rooms)

The listener is now set up to:
- ✅ Listen to all room documents in real-time
- ✅ Receive instant updates when `isAvailable` or `occupiedBy` changes
- ✅ Map each room to unit format automatically
- ✅ Update the dashboard within 1 second of change

---

## Testing

To verify it's working:

1. **Open the Unit Layout Dashboard**
   - Should load all rooms
   - Console shows: "Processed X units from snapshot"

2. **Make a Change in Firestore Console**
   - Edit a room: Change `isAvailable` from `true` to `false`
   - Watch console for: "Firestore snapshot received"
   - Dashboard should update within 1 second

3. **Expected Console Logs**
   ```
   ✅ 📡 Setting up real-time listener for units, landlord: [UID]
   ✅ ✅ Real-time listener setup complete
   ✅ 📡 Firestore snapshot received
      - Total docs: 22
      - Changes: 1
      - UPDATE: room-document-id
   ✅ 📡 Processed 22 units from snapshot
      - Sample unit: {
          id: "room-id",
          roomNumber: "1A",
          floor: 1,
          status: "vacant",
          isAvailable: true,
          occupiedBy: "N/A"
        }
   ✅ ✅ Calling callback with 22 valid units
   ✅ 🔄 Updating unit layout with new data...
   ```

---

## No Code Changes Needed

✅ All existing app.js code works with the mapping  
✅ All field references use compatible names  
✅ The mapping happens automatically in DataManager  
✅ No UI changes required

---

## If Still Not Working

1. ✅ Verify `rooms` collection exists in Firestore
2. ✅ Verify documents have `roomNumber`, `floor`, `isAvailable` fields
3. ✅ Check browser console for error messages
4. ✅ Verify no Firestore security rule blocking reads
5. ✅ Check that `rooms` collection is not empty

If you see "Processed 0 units", the `rooms` collection isn't found or is empty.

---

**Status:** Ready to Deploy ✅
