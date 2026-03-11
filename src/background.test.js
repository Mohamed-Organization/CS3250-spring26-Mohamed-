/**
 * @jest-environment node
 */
// AI prompt: prompted claude to guide me on how to write a test file for the background.js
'use strict';

// ── Step 1: Fake the browser extension APIs ───────────────────────────────────
// background.js uses browser.storage, browser.alarms, browser.tabs, and
// browser.runtime — none of these exist in Node/Jest, so we fake them all
let alarmListener;
let messageListener;
let installedListener;

global.browser = {
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn(),
        }
    },
    alarms: {
        onAlarm: {
            addListener: jest.fn(fn => { alarmListener = fn; })
        },
        create: jest.fn(),
    },
    tabs: {
        query: jest.fn(),
        sendMessage: jest.fn(),
    },
    runtime: {
        onMessage: {
            addListener: jest.fn(fn => { messageListener = fn; })
        },
        onInstalled: {
            addListener: jest.fn(fn => { installedListener = fn; })
        },
    }
};

// ── Step 2: Load background.js ────────────────────────────────────────────────
const {
    getStorage,
    setStorage,
    nextIndex,
    broadcastSetBackground,
} = require('./background');

// ── Helper: build a fake storage state ───────────────────────────────────────
function makeStore(overrides = {}) {
    return {
        groups: [{ id: 'g1', name: 'Group1', images: ['img1.png', 'img2.png'], intervalMs: 60000 }],
        activeGroupId: 'g1',
        currentIndex: { g1: 0 },
        ...overrides
    };
}

// ── Before each test: reset all mocks ────────────────────────────────────────
beforeEach(() => {
    jest.clearAllMocks();
    browser.storage.local.get.mockResolvedValue({});
    browser.storage.local.set.mockResolvedValue();
    browser.tabs.query.mockResolvedValue([]);
    browser.tabs.sendMessage.mockResolvedValue();
});

// =============================================================================
// TESTS FOR: getStorage()
// =============================================================================
describe('getStorage', () => {

    test('returns values from browser local storage', async () => {
        browser.storage.local.get.mockResolvedValue({ groups: [] });

        const result = await getStorage(['groups']);

        expect(result).toEqual({ groups: [] });
        expect(browser.storage.local.get).toHaveBeenCalledWith(['groups']);
    });
});

// =============================================================================
// TESTS FOR: setStorage()
// =============================================================================
describe('setStorage', () => {

    test('saves values to browser local storage', async () => {
        await setStorage({ groups: [] });

        expect(browser.storage.local.set).toHaveBeenCalledWith({ groups: [] });
    });
});

// =============================================================================
// TESTS FOR: nextIndex()
// =============================================================================
describe('nextIndex', () => {

    test('returns 0 when length is 0', () => {
        expect(nextIndex(0, 0)).toBe(0);
    });

    test('increments the index normally', () => {
        expect(nextIndex(0, 3)).toBe(1);
        expect(nextIndex(1, 3)).toBe(2);
    });

    test('wraps back around to 0 at the end of the list', () => {
        expect(nextIndex(2, 3)).toBe(0);
    });
});

// =============================================================================
// TESTS FOR: broadcastSetBackground()
// =============================================================================
describe('broadcastSetBackground', () => {

    test('sends a setBackground message to all open tabs', async () => {
        browser.tabs.query.mockResolvedValue([{ id: 1 }, { id: 2 }]);

        await broadcastSetBackground('img.png');

        expect(browser.tabs.sendMessage).toHaveBeenCalledTimes(2);
        expect(browser.tabs.sendMessage).toHaveBeenCalledWith(1, { type: 'setBackground', url: 'img.png' });
        expect(browser.tabs.sendMessage).toHaveBeenCalledWith(2, { type: 'setBackground', url: 'img.png' });
    });

    test('silently ignores tabs that do not have the content script', async () => {
        browser.tabs.query.mockResolvedValue([{ id: 1 }, { id: 2 }]);
        browser.tabs.sendMessage
            .mockRejectedValueOnce(new Error('no content script'))
            .mockResolvedValueOnce();

        await expect(broadcastSetBackground('img.png')).resolves.not.toThrow();
    });

    test('does nothing when there are no open tabs', async () => {
        browser.tabs.query.mockResolvedValue([]);

        await broadcastSetBackground('img.png');

        expect(browser.tabs.sendMessage).not.toHaveBeenCalled();
    });
});

// =============================================================================
// TESTS FOR: alarms.onAlarm listener
// =============================================================================
describe('alarms.onAlarm listener', () => {

    test('cycles to the next image when the cycle alarm fires', async () => {
        const store = makeStore();
        browser.storage.local.get.mockResolvedValue(store);
        browser.tabs.query.mockResolvedValue([{ id: 1 }]);

        await alarmListener({ name: 'cycle' });

        expect(browser.storage.local.set).toHaveBeenCalledWith({ currentIndex: { g1: 1 } });
        expect(browser.tabs.sendMessage).toHaveBeenCalledWith(1, { type: 'setBackground', url: 'img2.png' });
    });

    test('does nothing when the alarm name is not cycle', async () => {
        await alarmListener({ name: 'some-other-alarm' });

        expect(browser.storage.local.set).not.toHaveBeenCalled();
    });

    test('does nothing when alarm is null', async () => {
        await alarmListener(null);

        expect(browser.storage.local.set).not.toHaveBeenCalled();
    });

    test('does nothing when the active group has no images', async () => {
        const store = makeStore();
        store.groups[0].images = [];
        browser.storage.local.get.mockResolvedValue(store);

        await alarmListener({ name: 'cycle' });

        expect(browser.storage.local.set).not.toHaveBeenCalled();
    });

    test('does nothing when the active group cannot be found', async () => {
        const store = makeStore({ activeGroupId: 'nonexistent' });
        browser.storage.local.get.mockResolvedValue(store);

        await alarmListener({ name: 'cycle' });

        expect(browser.storage.local.set).not.toHaveBeenCalled();
    });

    test('defaults currentIndex to 0 when it has never been set', async () => {
        const store = makeStore({ currentIndex: {} });
        browser.storage.local.get.mockResolvedValue(store);
        browser.tabs.query.mockResolvedValue([]);

        await alarmListener({ name: 'cycle' });

        expect(browser.storage.local.set).toHaveBeenCalledWith({ currentIndex: { g1: 1 } });
    });
});

// =============================================================================
// TESTS FOR: runtime.onMessage listener
// =============================================================================
describe('runtime.onMessage listener', () => {

    test('returns undefined for a null message', async () => {
        const result = await messageListener(null, {});
        expect(result).toBeUndefined();
    });

    test('returns undefined for a message with no type', async () => {
        const result = await messageListener({}, {});
        expect(result).toBeUndefined();
    });

    // ── getState ──────────────────────────────────────────────────────────────
    describe('getState', () => {

        test('returns the full current state from storage', async () => {
            const store = makeStore();
            browser.storage.local.get.mockResolvedValue(store);

            const result = await messageListener({ type: 'getState' }, {});

            expect(result).toEqual(store);
        });
    });

    // ── setActiveGroup ────────────────────────────────────────────────────────
    describe('setActiveGroup', () => {

        test('saves the active group and creates an alarm', async () => {
            const store = makeStore();
            browser.storage.local.get
                .mockResolvedValueOnce({ currentIndex: { g1: 0 } })
                .mockResolvedValueOnce({ groups: store.groups });

            const result = await messageListener({ type: 'setActiveGroup', groupId: 'g1' }, {});

            expect(browser.storage.local.set).toHaveBeenCalledWith({ activeGroupId: 'g1' });
            expect(browser.alarms.create).toHaveBeenCalledWith('cycle', { periodInMinutes: 1 });
            expect(result).toEqual({ ok: true });
        });

        test('does not create an alarm when intervalMs is less than 60000', async () => {
            browser.storage.local.get
                .mockResolvedValueOnce({ currentIndex: {} })
                .mockResolvedValueOnce({ groups: [{ id: 'g1', intervalMs: 30000 }] });

            await messageListener({ type: 'setActiveGroup', groupId: 'g1' }, {});

            expect(browser.alarms.create).not.toHaveBeenCalled();
        });

        test('does not create an alarm when the group is not found', async () => {
            browser.storage.local.get
                .mockResolvedValueOnce({ currentIndex: {} })
                .mockResolvedValueOnce({ groups: [] });

            await messageListener({ type: 'setActiveGroup', groupId: 'g1' }, {});

            expect(browser.alarms.create).not.toHaveBeenCalled();
        });
    });

    // ── next ──────────────────────────────────────────────────────────────────
    describe('next', () => {

        test('advances to the next image manually', async () => {
            const store = makeStore();
            browser.storage.local.get.mockResolvedValue(store);
            browser.tabs.query.mockResolvedValue([{ id: 1 }]);

            const result = await messageListener({ type: 'next' }, {});

            expect(result).toEqual({ ok: true });
            expect(browser.storage.local.set).toHaveBeenCalledWith({ currentIndex: { g1: 1 } });
        });

        test('returns ok false when the active group has no images', async () => {
            const store = makeStore();
            store.groups[0].images = [];
            browser.storage.local.get.mockResolvedValue(store);

            const result = await messageListener({ type: 'next' }, {});

            expect(result).toEqual({ ok: false });
        });

        test('returns ok false when the active group cannot be found', async () => {
            const store = makeStore({ activeGroupId: 'nonexistent' });
            browser.storage.local.get.mockResolvedValue(store);

            const result = await messageListener({ type: 'next' }, {});

            expect(result).toEqual({ ok: false });
        });
    });
});

// =============================================================================
// TESTS FOR: runtime.onInstalled listener
// =============================================================================
describe('runtime.onInstalled listener', () => {

    test('sets default group data on a fresh install', async () => {
        browser.storage.local.get.mockResolvedValue({});

        await installedListener({ reason: 'install' });

        expect(browser.storage.local.set).toHaveBeenCalledWith(
            expect.objectContaining({ groups: expect.any(Array) })
        );
    });

    test('does not overwrite groups that already exist in storage', async () => {
        browser.storage.local.get.mockResolvedValue({ groups: [{ id: 'existing' }] });

        await installedListener({ reason: 'install' });

        expect(browser.storage.local.set).not.toHaveBeenCalled();
    });
});
