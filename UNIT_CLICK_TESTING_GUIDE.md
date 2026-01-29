# Unit Click Handler Debugging Guide

## ✅ What I Fixed

The `showUnitDetails` method was trying to access fields that don't exist in your rooms collection:
- Was looking for `unit.status` → Your field is `isAvailable` (boolean)
- Was looking for `unit.type` → Your rooms don't have a type field
- Was looking for `unit.unitNumber` → Your field is `roomNumber`

Now it properly uses your actual room fields:
- `roomNumber` (your field) ✅
- `isAvailable` (boolean) → converts to "Vacant"/"Occupied" ✅
- `floor`, `monthlyRent`, `numberOfBedrooms`, `numberOfBathrooms`, etc. ✅

## 🖱️ How Clicks Are Handled

### Step 1: Click Detection
```javascript
// When you click a unit card, two handlers listen:
1. Direct onclick handler on each unit card
2. Global modal click handler (backup)
```

### Step 2: Event Flow
```
User clicks unit
    ↓
setupUnitClickHandlers() attaches listeners (after 500ms delay)
    ↓
Unit card's onclick handler fires
    ↓
Calls showUnitDetails(unitId)
    ↓
Fetches room data from Firestore
    ↓
Displays detailed modal with room information
```

## 🧪 Testing the Click Handlers

### Test 1: Check Console Logs
1. **Open the Unit Layout Dashboard**
2. **Open DevTools** (F12)
3. **Go to Console tab**
4. Look for these logs:

```
✅ 📡 Setting up real-time listener for units, landlord: [UID]
✅ ✅ Real-time listener setup complete
✅ 📡 Firestore snapshot received
✅ 🖱️ Setting up click handlers...
✅ ⏰ DOM should be ready, setting up click handlers...
✅ 📊 Found X grid cells
✅ 🃏 Found X unit cards
✅ Click handlers setup complete
👉 Click any unit to test
```

### Test 2: Click a Unit
1. **Click on any unit card** in the grid
2. **Watch for these logs:**

```
🎯 CLICKED: Unit card [unit-id]
🔍 showUnitDetails called with ID: [unit-id]
✅ Unit details shown: [room-number]
```

3. **A modal should appear** showing:
   - Room Number
   - Floor
   - Status (Vacant/Occupied)
   - Monthly Rent
   - Bedrooms
   - Bathrooms
   - Max Capacity
   - Security Deposit
   - Occupancy info
   - Date information

### Test 3: Check for Errors
If nothing happens when you click, look for errors in console like:
```
❌ Error in showUnitDetails: ...
❌ No modal provided
❌ setupUnitClickHandlers method not found!
```

## 🔍 Debugging Checklist

- [ ] Console shows "Click handlers setup complete"
- [ ] Console shows X unit cards found (should be 22)
- [ ] Clicking a unit logs "🎯 CLICKED: Unit card"
- [ ] Modal appears when unit is clicked
- [ ] Modal shows correct room details
- [ ] No error messages in console
- [ ] Real-time updates still work (change isAvailable in Firestore)

## 💡 If Still Not Working

### Issue: "No click handler logs appear"
**Solution:** Check if setupUnitClickHandlers is being called
```javascript
// In console, check if method exists:
window.app.setupUnitClickHandlers
// Should show: ƒ setupUnitClickHandlers(modal) { ... }

// If undefined, the method wasn't bound properly
```

### Issue: "Click works but modal doesn't show"
**Solution:** Check if ModalManager is working
```javascript
// In console, test ModalManager:
ModalManager.openModal('Test', { title: 'Test Modal' })
// Should open a modal
```

### Issue: "Modal appears but shows 'Unit Not Found'"
**Solution:** The unit ID doesn't exist in Firestore
```javascript
// Check if rooms exist:
firebase.firestore()
  .collection('rooms')
  .limit(1)
  .get()
  .then(snap => console.log('Rooms found:', snap.size))
```

### Issue: "Modal appears but shows 'N/A' for all fields"
**Solution:** Room fields don't match expected names
```javascript
// Check actual room data:
firebase.firestore()
  .collection('rooms')
  .limit(1)
  .get()
  .then(snap => {
    console.log('Sample room:', snap.docs[0].data());
  })
// Compare with expected fields
```

## 📊 Expected Modal Display

When you click a unit, you should see a nicely formatted modal like:

```
╔════════════════════════════════════════╗
║        UNIT DETAILS                    ║
╠════════════════════════════════════════╣
║ Room Information    │ Room Details     ║
║ Room: 1A            │ Bedrooms: 1      ║
║ Floor: 1            │ Bathrooms: 1     ║
║ Status: [Vacant]    │ Capacity: 1      ║
║ Rent: ₱10,000       │ Deposit: ₱10,000 ║
╠════════════════════════════════════════╣
║ Occupancy                              ║
║ Current: 0/1                           ║
║ ✓ Available for Occupancy             ║
╠════════════════════════════════════════╣
║ Created: 11/13/2025                   ║
║ Last Updated: 12/4/2025               ║
╚════════════════════════════════════════╝
```

## 🚀 Next Steps

1. **Test in your browser**
2. **Check console for logs**
3. **Click a unit and verify modal appears**
4. **If working:** You're done! ✅
5. **If not working:** Share console errors with me

---

**Status:** Click handlers are now properly integrated and use correct field names ✅
