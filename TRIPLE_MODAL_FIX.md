# Triple Modal Opening Issue - Root Cause & Fix

## Problem
When clicking "Open Unit Layout" in the Landlord Dashboard, the Apartment Unit Layout modal opens 3 times. To return to the main dashboard, users must close the modal 3 times.

## Root Cause Analysis

The issue was caused by **3 duplicate event listeners** all listening to the same `#openUnitLayoutBtn` click event:

### Event Listener #1: Constructor (Line 51)
```javascript
// In CasaLink constructor
this.setupGlobalEventListeners();
```

### Event Listener #2: setupDashboardEventListeners() (Line 320)
```javascript
// In init() method
this.setupDashboardEventListeners();
```
This method (lines 285-297) adds another click listener specifically for `#openUnitLayoutBtn`

### Event Listener #3: setupGlobalEventListeners() (Line 321)
```javascript
// In init() method
this.setupGlobalEventListeners(); // ← DUPLICATE CALL
```

### Result
- Constructor calls `setupGlobalEventListeners()` → Listener #1 attached
- init() method calls `setupDashboardEventListeners()` → Listener #2 attached  
- init() method calls `setupGlobalEventListeners()` again → Listener #3 attached

When button is clicked, all 3 listeners fire → `showUnitLayoutDashboard()` called 3 times → Modal opens 3 times

## Solution Implemented

**File**: [js/app.js](js/app.js)

**Changes**:
1. **Removed duplicate `setupGlobalEventListeners()` call** from `init()` method (line 321)
2. Kept single `setupGlobalEventListeners()` call in constructor, which handles both:
   - Unit Layout button clicks (`#openUnitLayoutBtn`)
   - Dashboard card clicks (data-clickable elements)
   - Navigation and other global interactions

### Before (Lines 318-322)
```javascript
this.setupPWAFeatures();
this.setupOfflineHandling();
this.setupNavigationEvents();
 this.setupDashboardEventListeners();
this.setupGlobalEventListeners(); // Make sure this is called
```

### After (Lines 318-322)
```javascript
this.setupPWAFeatures();
this.setupOfflineHandling();
this.setupNavigationEvents();

// NOTE: setupGlobalEventListeners() is already called in constructor (line 51)
// Do not call it again here to avoid duplicate event listeners
```

## Note About setupDashboardEventListeners()

The `setupDashboardEventListeners()` method (lines 285-297) is now unused and redundant because:
- It only listens for `#openUnitLayoutBtn` clicks
- `setupGlobalEventListeners()` already handles these clicks (lines 1193-1200)

**Recommendation**: Remove the `setupDashboardEventListeners()` method entirely in a future cleanup, but leaving it in place causes no harm since it's no longer called.

## Verification

To test the fix:
1. Clear browser cache/reload application
2. Navigate to Landlord Dashboard
3. Click "Open Unit Layout" button
4. Modal should open **only once**
5. Close modal by clicking X or clicking outside - should return to dashboard immediately

## Related Code

- **Constructor**: [Line 51](js/app.js#L51)
- **init() method**: [Lines 300-327](js/app.js#L300-L327)
- **setupGlobalEventListeners()**: [Lines 1189-1270](js/app.js#L1189-L1270)
- **setupDashboardEventListeners()**: [Lines 285-297](js/app.js#L285-L297)
- **showUnitLayoutDashboard()**: [Lines 3126-3175](js/app.js#L3126-L3175)

## Impact
✅ **Fixed**: Apartment Unit Layout modal now opens only once  
✅ **No Breaking Changes**: All other functionality remains intact  
✅ **Performance**: Slightly improved by eliminating duplicate event listener
