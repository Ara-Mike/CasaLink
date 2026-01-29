# Real-Time Unit Layout Debugging Checklist

## Step 1: Check Firestore Connection ✓
**Open browser DevTools Console and run:**

```javascript
// Test 1: Check if Firebase is initialized
firebase.auth().currentUser?.uid  
// Should show your user ID (not undefined)

// Test 2: Check if apartmentUnits collection exists
firebase.firestore().collection('apartmentUnits').limit(1).get()
  .then(snap => {
    console.log('✅ Collection exists:', snap.size > 0);
    if (snap.size > 0) {
      console.log('First document:', snap.docs[0].data());
    }
  })
  .catch(err => console.error('❌ Error:', err.message));

// Test 3: Check units for current user
const uid = firebase.auth().currentUser?.uid;
firebase.firestore()
  .collection('apartmentUnits')
  .where('landlordId', '==', uid)
  .get()
  .then(snap => {
    console.log(`Found ${snap.size} units for landlord ${uid}`);
    snap.docs.forEach(doc => {
      console.log('Unit:', doc.data());
    });
  })
  .catch(err => console.error('Error:', err));
```

**Expected Results:**
- ✅ User UID shows (not undefined)
- ✅ apartmentUnits collection has documents
- ✅ Units found for current landlord

---

## Step 2: Check Real-Time Listener Activation ✓
**In Console, open the Unit Layout Dashboard and watch for logs:**

```
Look for these messages:
✅ 📡 Setting up real-time listener...
✅ 📡 Setting up real-time listener for units, landlord: [UID]
✅ ✅ Real-time listener setup complete
✅ 📡 Firestore snapshot received
✅ ✅ Calling callback with X units

Missing messages mean:
❌ Listener not setup
❌ Snapshot not received (permission issue?)
❌ Callback not invoked
```

---

## Step 3: Monitor Real-Time Updates ✓
**Once dashboard is open, make a change in Firestore:**

1. **Open Firebase Console** → Your Project → Cloud Firestore
2. **Edit an apartment unit** → Change status from "vacant" to "occupied"
3. **Watch Console Logs** for:
   ```
   📡 Firestore snapshot received
      - Total docs: X
      - Changes: 1
      - UPDATE: [document-id]
   📡 Processed X units from snapshot
   ✅ Calling callback with X units
   🔄 Updating unit layout with new data...
   ```
4. **Watch Dashboard** for:
   - ✅ Stat count updates (occupied count increases)
   - ✅ Unit card color changes
   - ✅ Status badge updates

**If you DON'T see these logs:**
- Check Firestore Security Rules (see Step 4)
- Check browser console for errors (scroll up!)
- Verify `apartmentUnits` collection has documents

---

## Step 4: Check Firestore Security Rules ✓
**Your security rules should allow read/write for landlords:**

**Location:** Firebase Console → Cloud Firestore → Rules

**Current Rules Should Include:**
```javascript
match /apartmentUnits/{document=**} {
  allow read, write: if request.auth.uid == resource.data.landlordId;
}
```

**To Fix (if missing):**
1. Go to Firebase Console
2. Cloud Firestore → Rules tab
3. Replace with:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /apartmentUnits/{document=**} {
         allow read, write: if request.auth.uid == resource.data.landlordId;
       }
     }
   }
   ```
4. Click "Publish"

---

## Step 5: Verify Unit Data Structure ✓
**Your units must have these fields:**

```javascript
{
  landlordId: "user-uid",      // Must match current user UID
  floor: 1,                     // Number 1-5 (5 = rooftop)
  unitNumber: "1A",             // String
  status: "vacant",             // "vacant", "occupied", "maintenance", or "reserved"
  tenantName: "John Doe",       // Optional - can be null
  roomNumber: "1A",             // Optional
  // ... other fields OK
}
```

**To Check in Firestore Console:**
1. Cloud Firestore → apartmentUnits collection
2. Click any document
3. Verify fields match above structure

**Common Issues:**
- ❌ `landlord_id` (underscore) instead of `landlordId` (camelCase)
- ❌ `floor: "1"` (string) should be `floor: 1` (number)
- ❌ `status: "Vacant"` (capitalized) should be `"vacant"` (lowercase)
- ❌ Missing `landlordId` field entirely

---

## Step 6: Check Browser Console for Errors ✓
**In DevTools Console, look for:**

```
ERROR messages starting with:
❌ Invalid modal element
❌ Invalid units data
❌ Error in real-time listener
❌ Firestore permission denied
❌ Collection not found
```

**If found, note the exact error and check:**
- Firestore Rules (Step 4)
- Unit data structure (Step 5)
- Modal DOM existence

---

## Step 7: Test Update Propagation ✓
**Run this in Console while dashboard is open:**

```javascript
// Get the modal
const modal = document.querySelector('[role="dialog"].modal-overlay');
console.log('Modal exists:', !!modal);

// Check if unsubscribe is stored
const unsubscribe = modal?.dataset.unsubscribe;
console.log('Unsubscribe function:', typeof unsubscribe);

// Manually trigger callback test
if (window.app && window.app.updateUnitLayout) {
  const testUnits = [
    { id: 'test1', floor: 1, unitNumber: '1A', status: 'occupied' },
    { id: 'test2', floor: 1, unitNumber: '1B', status: 'vacant' }
  ];
  window.app.updateUnitLayout(testUnits, modal);
  console.log('✅ Manual update test completed');
}
```

**Expected:**
- ✅ Modal exists: true
- ✅ Unsubscribe function: function
- ✅ Dashboard updates with test units

---

## Step 8: Performance Monitoring ✓
**Monitor these metrics when data updates:**

```javascript
// In Console, watch for timing:
console.time('Real-time update');
// [Real-time update logs appear]
console.timeEnd('Real-time update');
// Should complete in < 1000ms (1 second)
```

**If taking > 2 seconds:**
- Too many units being rendered
- Firestore query is slow
- DOM is being updated too slowly

---

## Quick Fixes to Try

### Issue: "Permission denied" errors
**Solution:**
1. Go to Firebase Console → Authentication
2. Verify user is signed in with correct UID
3. Check Firestore Rules allow read for that UID

### Issue: Console shows "No callback function provided"
**Solution:**
- Your code is calling `getUnitsWithRealtimeUpdates()` but not passing callback
- Check line 3161 in app.js has `(updatedUnits) => { ... }` callback

### Issue: Dashboard loads but doesn't update when data changes
**Solution:**
- Modal might not be in DOM anymore
- We added DOM validation in the callback (check Step 1)
- Try refreshing page and testing again

### Issue: Numbers don't match between Firestore and Dashboard
**Solution:**
- Check if `landlordId` field values match exactly (case-sensitive)
- Verify no duplicate documents in `apartmentUnits`
- Clear browser cache (Ctrl+Shift+Delete) and reload

---

## Logs to Capture

**When reporting issues, provide:**

1. **Initial load logs** (first 10 lines after opening dashboard)
2. **Real-time update logs** (from making change in Firestore)
3. **Error logs** (any red/orange messages in console)
4. **Sample unit data** (one unit from Firestore)

**How to capture:**
1. Open DevTools Console
2. Right-click → "Save as" → Save HTML
3. Attach to bug report

---

## Final Verification

Once everything is working, you should see:
- ✅ Dashboard loads with correct unit count
- ✅ Console shows "Real-time listener setup complete"
- ✅ Change a unit in Firestore
- ✅ Dashboard updates within 1 second
- ✅ Console shows "Calling callback with X units"
- ✅ Stat numbers and unit cards refresh
- ✅ No error messages in console

**All checks passing?** 🎉 You're done!
