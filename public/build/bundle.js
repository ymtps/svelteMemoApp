
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function stop_propagation(fn) {
        return function (event) {
            event.stopPropagation();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.46.2' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const screenType = writable(0); // 0:一覧画面 1:詳細画面
    const showDeleteMemoModalFlg = writable(false);
    const selectIndex = writable(null);
    const memoList = writable([]);

    /* src/component/MemoList.svelte generated by Svelte v3.46.2 */

    const file$5 = "src/component/MemoList.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i].title;
    	child_ctx[6] = list[i].date;
    	child_ctx[8] = i;
    	return child_ctx;
    }

    // (60:0) {:else}
    function create_else_block(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "メモは１件も登録されていません";
    			add_location(p, file$5, 60, 1, 1237);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(60:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (48:0) {#if $memoList.length > 0}
    function create_if_block$2(ctx) {
    	let ul;
    	let each_value = /*$memoList*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(ul, "class", "memo-list svelte-a2yzql");
    			add_location(ul, file$5, 48, 1, 922);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*showMemoDetailPage, showDeleteMemoModal, $memoList*/ 7) {
    				each_value = /*$memoList*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(48:0) {#if $memoList.length > 0}",
    		ctx
    	});

    	return block;
    }

    // (50:2) {#each $memoList as { title, date }
    function create_each_block(ctx) {
    	let li;
    	let p0;
    	let t0_value = /*title*/ ctx[5] + "";
    	let t0;
    	let t1;
    	let p1;
    	let t2;
    	let t3_value = /*date*/ ctx[6] + "";
    	let t3;
    	let t4;
    	let span;
    	let t6;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[3](/*i*/ ctx[8]);
    	}

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[4](/*i*/ ctx[8]);
    	}

    	const block = {
    		c: function create() {
    			li = element("li");
    			p0 = element("p");
    			t0 = text(t0_value);
    			t1 = space();
    			p1 = element("p");
    			t2 = text("登録日：");
    			t3 = text(t3_value);
    			t4 = space();
    			span = element("span");
    			span.textContent = "×";
    			t6 = space();
    			attr_dev(p0, "class", "title svelte-a2yzql");
    			add_location(p0, file$5, 51, 4, 1038);
    			attr_dev(p1, "class", "date");
    			add_location(p1, file$5, 52, 4, 1071);
    			attr_dev(span, "class", "delete svelte-a2yzql");
    			add_location(span, file$5, 53, 4, 1106);
    			attr_dev(li, "class", "svelte-a2yzql");
    			add_location(li, file$5, 50, 3, 990);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, p0);
    			append_dev(p0, t0);
    			append_dev(li, t1);
    			append_dev(li, p1);
    			append_dev(p1, t2);
    			append_dev(p1, t3);
    			append_dev(li, t4);
    			append_dev(li, span);
    			append_dev(li, t6);

    			if (!mounted) {
    				dispose = [
    					listen_dev(span, "click", stop_propagation(click_handler), false, false, true),
    					listen_dev(li, "click", click_handler_1, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*$memoList*/ 1 && t0_value !== (t0_value = /*title*/ ctx[5] + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*$memoList*/ 1 && t3_value !== (t3_value = /*date*/ ctx[6] + "")) set_data_dev(t3, t3_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(50:2) {#each $memoList as { title, date }",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let if_block_anchor;

    	function select_block_type(ctx, dirty) {
    		if (/*$memoList*/ ctx[0].length > 0) return create_if_block$2;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let $memoList;
    	validate_store(memoList, 'memoList');
    	component_subscribe($$self, memoList, $$value => $$invalidate(0, $memoList = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('MemoList', slots, []);

    	function showDeleteMemoModal(index) {
    		selectIndex.set(index);
    		showDeleteMemoModalFlg.set(true);
    	}

    	/**
     * 詳細ページを非表示
     *
     * @param {number} index 選択したメモのインデックス
     */
    	function showMemoDetailPage(index) {
    		selectIndex.set(index);
    		screenType.set(1);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<MemoList> was created with unknown prop '${key}'`);
    	});

    	const click_handler = i => showDeleteMemoModal(i);
    	const click_handler_1 = i => showMemoDetailPage(i);

    	$$self.$capture_state = () => ({
    		screenType,
    		memoList,
    		showDeleteMemoModalFlg,
    		selectIndex,
    		showDeleteMemoModal,
    		showMemoDetailPage,
    		$memoList
    	});

    	return [
    		$memoList,
    		showDeleteMemoModal,
    		showMemoDetailPage,
    		click_handler,
    		click_handler_1
    	];
    }

    class MemoList extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MemoList",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src/component/modal/RegistMemoModal.svelte generated by Svelte v3.46.2 */
    const file$4 = "src/component/modal/RegistMemoModal.svelte";

    function create_fragment$4(ctx) {
    	let div4;
    	let div3;
    	let div2;
    	let span;
    	let t1;
    	let h2;
    	let t3;
    	let div0;
    	let label0;
    	let p0;
    	let t5;
    	let input;
    	let t6;
    	let label1;
    	let p1;
    	let t8;
    	let textarea;
    	let t9;
    	let div1;
    	let button0;
    	let t11;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			div3 = element("div");
    			div2 = element("div");
    			span = element("span");
    			span.textContent = "×";
    			t1 = space();
    			h2 = element("h2");
    			h2.textContent = "メモを登録";
    			t3 = space();
    			div0 = element("div");
    			label0 = element("label");
    			p0 = element("p");
    			p0.textContent = "タイトル";
    			t5 = space();
    			input = element("input");
    			t6 = space();
    			label1 = element("label");
    			p1 = element("p");
    			p1.textContent = "内容";
    			t8 = space();
    			textarea = element("textarea");
    			t9 = space();
    			div1 = element("div");
    			button0 = element("button");
    			button0.textContent = "キャンセル";
    			t11 = space();
    			button1 = element("button");
    			button1.textContent = "登録";
    			attr_dev(span, "class", "close svelte-k0tuma");
    			add_location(span, file$4, 107, 3, 2231);
    			attr_dev(h2, "class", "title svelte-k0tuma");
    			add_location(h2, file$4, 108, 3, 2285);
    			add_location(p0, file$4, 111, 5, 2377);
    			attr_dev(input, "type", "text");
    			attr_dev(input, "class", "svelte-k0tuma");
    			add_location(input, file$4, 112, 5, 2394);
    			attr_dev(label0, "class", "input-title svelte-k0tuma");
    			add_location(label0, file$4, 110, 4, 2344);
    			add_location(p1, file$4, 115, 5, 2491);
    			attr_dev(textarea, "class", "svelte-k0tuma");
    			add_location(textarea, file$4, 116, 5, 2506);
    			attr_dev(label1, "class", "input-context svelte-k0tuma");
    			add_location(label1, file$4, 114, 4, 2456);
    			attr_dev(div0, "class", "contents svelte-k0tuma");
    			add_location(div0, file$4, 109, 3, 2317);
    			attr_dev(button0, "class", "btn svelte-k0tuma");
    			add_location(button0, file$4, 120, 4, 2596);
    			attr_dev(button1, "class", "btn svelte-k0tuma");
    			add_location(button1, file$4, 121, 4, 2657);
    			attr_dev(div1, "class", "buttons svelte-k0tuma");
    			add_location(div1, file$4, 119, 3, 2570);
    			attr_dev(div2, "class", "modal-contents svelte-k0tuma");
    			add_location(div2, file$4, 106, 2, 2199);
    			attr_dev(div3, "class", "modal-background svelte-k0tuma");
    			add_location(div3, file$4, 105, 1, 2166);
    			attr_dev(div4, "class", "modal svelte-k0tuma");
    			add_location(div4, file$4, 104, 0, 2145);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div3);
    			append_dev(div3, div2);
    			append_dev(div2, span);
    			append_dev(div2, t1);
    			append_dev(div2, h2);
    			append_dev(div2, t3);
    			append_dev(div2, div0);
    			append_dev(div0, label0);
    			append_dev(label0, p0);
    			append_dev(label0, t5);
    			append_dev(label0, input);
    			set_input_value(input, /*memoTitle*/ ctx[0]);
    			append_dev(div0, t6);
    			append_dev(div0, label1);
    			append_dev(label1, p1);
    			append_dev(label1, t8);
    			append_dev(label1, textarea);
    			set_input_value(textarea, /*memoContext*/ ctx[1]);
    			append_dev(div2, t9);
    			append_dev(div2, div1);
    			append_dev(div1, button0);
    			append_dev(div1, t11);
    			append_dev(div1, button1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(span, "click", /*closeModal*/ ctx[3], false, false, false),
    					listen_dev(input, "input", /*input_input_handler*/ ctx[4]),
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[5]),
    					listen_dev(button0, "click", /*closeModal*/ ctx[3], false, false, false),
    					listen_dev(button1, "click", /*registMemo*/ ctx[2], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*memoTitle*/ 1 && input.value !== /*memoTitle*/ ctx[0]) {
    				set_input_value(input, /*memoTitle*/ ctx[0]);
    			}

    			if (dirty & /*memoContext*/ 2) {
    				set_input_value(textarea, /*memoContext*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('RegistMemoModal', slots, []);
    	const dispatch = createEventDispatcher();
    	let memoTitle = "";
    	let memoContext = "";

    	/**
     * メモを登録
     */
    	function registMemo() {
    		const localStorageMemoList = localStorage.getItem("memoList");

    		const newMemoList = localStorageMemoList
    		? JSON.parse(localStorageMemoList)
    		: [];

    		const now = new Date();

    		newMemoList.push({
    			title: memoTitle,
    			context: memoContext,
    			date: `${String(now.getFullYear())}年${String(now.getMonth() + 1)}月${String(now.getDate())}日`
    		});

    		localStorage.setItem("memoList", JSON.stringify(newMemoList));
    		memoList.set(newMemoList);
    		closeModal(); // 本モーダルを閉じる
    	}

    	/**
     * 本モーダルを閉じる
     */
    	function closeModal() {
    		dispatch("close");
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<RegistMemoModal> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		memoTitle = this.value;
    		$$invalidate(0, memoTitle);
    	}

    	function textarea_input_handler() {
    		memoContext = this.value;
    		$$invalidate(1, memoContext);
    	}

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		memoList,
    		dispatch,
    		memoTitle,
    		memoContext,
    		registMemo,
    		closeModal
    	});

    	$$self.$inject_state = $$props => {
    		if ('memoTitle' in $$props) $$invalidate(0, memoTitle = $$props.memoTitle);
    		if ('memoContext' in $$props) $$invalidate(1, memoContext = $$props.memoContext);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		memoTitle,
    		memoContext,
    		registMemo,
    		closeModal,
    		input_input_handler,
    		textarea_input_handler
    	];
    }

    class RegistMemoModal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "RegistMemoModal",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src/component/modal/DeleteMemoModal.svelte generated by Svelte v3.46.2 */
    const file$3 = "src/component/modal/DeleteMemoModal.svelte";

    function create_fragment$3(ctx) {
    	let div4;
    	let div3;
    	let div2;
    	let span;
    	let t1;
    	let h2;
    	let t3;
    	let div0;
    	let p;
    	let t7;
    	let div1;
    	let button0;
    	let t9;
    	let button1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			div3 = element("div");
    			div2 = element("div");
    			span = element("span");
    			span.textContent = "×";
    			t1 = space();
    			h2 = element("h2");
    			h2.textContent = "メモを削除";
    			t3 = space();
    			div0 = element("div");
    			p = element("p");
    			p.textContent = `『${/*memoTitle*/ ctx[0]}』のメモを削除してもよろしいですか`;
    			t7 = space();
    			div1 = element("div");
    			button0 = element("button");
    			button0.textContent = "キャンセル";
    			t9 = space();
    			button1 = element("button");
    			button1.textContent = "削除";
    			attr_dev(span, "class", "close svelte-c1ppbi");
    			add_location(span, file$3, 80, 3, 1623);
    			attr_dev(h2, "class", "title svelte-c1ppbi");
    			add_location(h2, file$3, 81, 3, 1677);
    			add_location(p, file$3, 83, 4, 1736);
    			attr_dev(div0, "class", "contents svelte-c1ppbi");
    			add_location(div0, file$3, 82, 3, 1709);
    			attr_dev(button0, "class", "btn svelte-c1ppbi");
    			add_location(button0, file$3, 86, 4, 1812);
    			attr_dev(button1, "class", "btn svelte-c1ppbi");
    			add_location(button1, file$3, 87, 4, 1873);
    			attr_dev(div1, "class", "buttons svelte-c1ppbi");
    			add_location(div1, file$3, 85, 3, 1786);
    			attr_dev(div2, "class", "modal-contents svelte-c1ppbi");
    			add_location(div2, file$3, 79, 2, 1591);
    			attr_dev(div3, "class", "modal-background svelte-c1ppbi");
    			add_location(div3, file$3, 78, 1, 1558);
    			attr_dev(div4, "class", "modal svelte-c1ppbi");
    			add_location(div4, file$3, 77, 0, 1537);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div3);
    			append_dev(div3, div2);
    			append_dev(div2, span);
    			append_dev(div2, t1);
    			append_dev(div2, h2);
    			append_dev(div2, t3);
    			append_dev(div2, div0);
    			append_dev(div0, p);
    			append_dev(div2, t7);
    			append_dev(div2, div1);
    			append_dev(div1, button0);
    			append_dev(div1, t9);
    			append_dev(div1, button1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(span, "click", /*closeModal*/ ctx[2], false, false, false),
    					listen_dev(button0, "click", /*closeModal*/ ctx[2], false, false, false),
    					listen_dev(button1, "click", /*deleteMemo*/ ctx[1], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let $selectIndex;
    	let $memoList;
    	validate_store(selectIndex, 'selectIndex');
    	component_subscribe($$self, selectIndex, $$value => $$invalidate(3, $selectIndex = $$value));
    	validate_store(memoList, 'memoList');
    	component_subscribe($$self, memoList, $$value => $$invalidate(4, $memoList = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('DeleteMemoModal', slots, []);
    	let memoTitle = $memoList[$selectIndex].title;

    	/**
     * メモを削除
     */
    	function deleteMemo() {
    		const localStorageMemoList = localStorage.getItem("memoList");

    		const newMemoList = localStorageMemoList
    		? JSON.parse(localStorageMemoList)
    		: [];

    		newMemoList.splice($selectIndex, 1);
    		localStorage.setItem("memoList", JSON.stringify(newMemoList));
    		memoList.set(newMemoList);
    		closeModal(); // 本モーダルを閉じる
    	}

    	/**
     * 本モーダルを閉じる
     */
    	function closeModal() {
    		showDeleteMemoModalFlg.set(false);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<DeleteMemoModal> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		memoList,
    		showDeleteMemoModalFlg,
    		selectIndex,
    		memoTitle,
    		deleteMemo,
    		closeModal,
    		$selectIndex,
    		$memoList
    	});

    	$$self.$inject_state = $$props => {
    		if ('memoTitle' in $$props) $$invalidate(0, memoTitle = $$props.memoTitle);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [memoTitle, deleteMemo, closeModal];
    }

    class DeleteMemoModal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "DeleteMemoModal",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src/pages/List.svelte generated by Svelte v3.46.2 */
    const file$2 = "src/pages/List.svelte";

    // (53:0) {#if showRegistMemoModalFlg}
    function create_if_block_1$1(ctx) {
    	let registmemomodal;
    	let current;
    	registmemomodal = new RegistMemoModal({ $$inline: true });
    	registmemomodal.$on("close", /*closeRegistMemoModal*/ ctx[3]);

    	const block = {
    		c: function create() {
    			create_component(registmemomodal.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(registmemomodal, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(registmemomodal.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(registmemomodal.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(registmemomodal, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(53:0) {#if showRegistMemoModalFlg}",
    		ctx
    	});

    	return block;
    }

    // (56:0) {#if $showDeleteMemoModalFlg}
    function create_if_block$1(ctx) {
    	let deletememomodal;
    	let current;
    	deletememomodal = new DeleteMemoModal({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(deletememomodal.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(deletememomodal, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(deletememomodal.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(deletememomodal.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(deletememomodal, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(56:0) {#if $showDeleteMemoModalFlg}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div2;
    	let div1;
    	let button;
    	let t1;
    	let div0;
    	let memolistcomponent;
    	let t2;
    	let t3;
    	let if_block1_anchor;
    	let current;
    	let mounted;
    	let dispose;
    	memolistcomponent = new MemoList({ $$inline: true });
    	let if_block0 = /*showRegistMemoModalFlg*/ ctx[0] && create_if_block_1$1(ctx);
    	let if_block1 = /*$showDeleteMemoModalFlg*/ ctx[1] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			button = element("button");
    			button.textContent = "メモを登録";
    			t1 = space();
    			div0 = element("div");
    			create_component(memolistcomponent.$$.fragment);
    			t2 = space();
    			if (if_block0) if_block0.c();
    			t3 = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    			attr_dev(button, "type", "button");
    			attr_dev(button, "class", "btn svelte-yhjybw");
    			add_location(button, file$2, 42, 2, 1027);
    			attr_dev(div0, "class", "memo-list-area svelte-yhjybw");
    			add_location(div0, file$2, 46, 2, 1118);
    			attr_dev(div1, "class", "contents svelte-yhjybw");
    			add_location(div1, file$2, 41, 1, 1002);
    			attr_dev(div2, "class", "home svelte-yhjybw");
    			add_location(div2, file$2, 40, 0, 982);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, button);
    			append_dev(div1, t1);
    			append_dev(div1, div0);
    			mount_component(memolistcomponent, div0, null);
    			insert_dev(target, t2, anchor);
    			if (if_block0) if_block0.m(target, anchor);
    			insert_dev(target, t3, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_dev(target, if_block1_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*showRegistMemoModal*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*showRegistMemoModalFlg*/ ctx[0]) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*showRegistMemoModalFlg*/ 1) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_1$1(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(t3.parentNode, t3);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*$showDeleteMemoModalFlg*/ ctx[1]) {
    				if (if_block1) {
    					if (dirty & /*$showDeleteMemoModalFlg*/ 2) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block$1(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(memolistcomponent.$$.fragment, local);
    			transition_in(if_block0);
    			transition_in(if_block1);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(memolistcomponent.$$.fragment, local);
    			transition_out(if_block0);
    			transition_out(if_block1);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_component(memolistcomponent);
    			if (detaching) detach_dev(t2);
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t3);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(if_block1_anchor);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let $showDeleteMemoModalFlg;
    	validate_store(showDeleteMemoModalFlg, 'showDeleteMemoModalFlg');
    	component_subscribe($$self, showDeleteMemoModalFlg, $$value => $$invalidate(1, $showDeleteMemoModalFlg = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('List', slots, []);
    	let showRegistMemoModalFlg = false; // メモ登録モーダルの表示フラグ

    	onMount(() => {
    		loadMemoList(); // ローカルストレージからメモ一覧を取得
    	});

    	/**
     * ローカルストレージからメモ一覧を取得
     */
    	function loadMemoList() {
    		const storageMemoList = JSON.parse(localStorage.getItem("memoList")) || [];
    		memoList.set(storageMemoList);
    	}

    	/**
     * メモ登録モーダルを表示
     */
    	function showRegistMemoModal() {
    		$$invalidate(0, showRegistMemoModalFlg = true);
    	}

    	/**
     * メモ登録モーダルを非表示
     */
    	function closeRegistMemoModal() {
    		$$invalidate(0, showRegistMemoModalFlg = false);
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<List> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		MemoListComponent: MemoList,
    		RegistMemoModal,
    		DeleteMemoModal,
    		memoList,
    		showDeleteMemoModalFlg,
    		onMount,
    		showRegistMemoModalFlg,
    		loadMemoList,
    		showRegistMemoModal,
    		closeRegistMemoModal,
    		$showDeleteMemoModalFlg
    	});

    	$$self.$inject_state = $$props => {
    		if ('showRegistMemoModalFlg' in $$props) $$invalidate(0, showRegistMemoModalFlg = $$props.showRegistMemoModalFlg);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		showRegistMemoModalFlg,
    		$showDeleteMemoModalFlg,
    		showRegistMemoModal,
    		closeRegistMemoModal
    	];
    }

    class List extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "List",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/pages/Detail.svelte generated by Svelte v3.46.2 */
    const file$1 = "src/pages/Detail.svelte";

    function create_fragment$1(ctx) {
    	let div2;
    	let p0;
    	let t1;
    	let div0;
    	let label0;
    	let p1;
    	let t3;
    	let input;
    	let t4;
    	let label1;
    	let p2;
    	let t6;
    	let textarea;
    	let t7;
    	let div1;
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			p0 = element("p");
    			p0.textContent = "一覧画面に戻る";
    			t1 = space();
    			div0 = element("div");
    			label0 = element("label");
    			p1 = element("p");
    			p1.textContent = "タイトル";
    			t3 = space();
    			input = element("input");
    			t4 = space();
    			label1 = element("label");
    			p2 = element("p");
    			p2.textContent = "内容";
    			t6 = space();
    			textarea = element("textarea");
    			t7 = space();
    			div1 = element("div");
    			button = element("button");
    			button.textContent = "更新";
    			attr_dev(p0, "class", "link-text");
    			add_location(p0, file$1, 60, 1, 1326);
    			add_location(p1, file$1, 63, 3, 1448);
    			attr_dev(input, "type", "text");
    			attr_dev(input, "class", "svelte-1xj36ab");
    			add_location(input, file$1, 64, 3, 1463);
    			attr_dev(label0, "class", "input-title svelte-1xj36ab");
    			add_location(label0, file$1, 62, 2, 1417);
    			add_location(p2, file$1, 67, 3, 1554);
    			attr_dev(textarea, "class", "svelte-1xj36ab");
    			add_location(textarea, file$1, 68, 3, 1567);
    			attr_dev(label1, "class", "input-context svelte-1xj36ab");
    			add_location(label1, file$1, 66, 2, 1521);
    			attr_dev(div0, "class", "contents svelte-1xj36ab");
    			add_location(div0, file$1, 61, 1, 1392);
    			attr_dev(button, "class", "btn svelte-1xj36ab");
    			add_location(button, file$1, 72, 2, 1649);
    			attr_dev(div1, "class", "buttons svelte-1xj36ab");
    			add_location(div1, file$1, 71, 1, 1625);
    			attr_dev(div2, "class", "detail svelte-1xj36ab");
    			add_location(div2, file$1, 59, 0, 1304);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, p0);
    			append_dev(div2, t1);
    			append_dev(div2, div0);
    			append_dev(div0, label0);
    			append_dev(label0, p1);
    			append_dev(label0, t3);
    			append_dev(label0, input);
    			set_input_value(input, /*memoTitle*/ ctx[0]);
    			append_dev(div0, t4);
    			append_dev(div0, label1);
    			append_dev(label1, p2);
    			append_dev(label1, t6);
    			append_dev(label1, textarea);
    			set_input_value(textarea, /*memoContext*/ ctx[1]);
    			append_dev(div2, t7);
    			append_dev(div2, div1);
    			append_dev(div1, button);

    			if (!mounted) {
    				dispose = [
    					listen_dev(p0, "click", /*click_handler*/ ctx[4], false, false, false),
    					listen_dev(input, "input", /*input_input_handler*/ ctx[5]),
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[6]),
    					listen_dev(button, "click", /*updateMemo*/ ctx[3], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*memoTitle*/ 1 && input.value !== /*memoTitle*/ ctx[0]) {
    				set_input_value(input, /*memoTitle*/ ctx[0]);
    			}

    			if (dirty & /*memoContext*/ 2) {
    				set_input_value(textarea, /*memoContext*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let $selectIndex;
    	let $memoList;
    	validate_store(selectIndex, 'selectIndex');
    	component_subscribe($$self, selectIndex, $$value => $$invalidate(7, $selectIndex = $$value));
    	validate_store(memoList, 'memoList');
    	component_subscribe($$self, memoList, $$value => $$invalidate(8, $memoList = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Detail', slots, []);
    	let memoTitle = $memoList[$selectIndex].title;
    	let memoContext = $memoList[$selectIndex].context;

    	/**
     * メモ一覧画面に戻る
     */
    	function backListPage() {
    		screenType.set(0);
    	}

    	/**
     * メモを更新する
     */
    	function updateMemo() {
    		const localStorageMemoList = localStorage.getItem("memoList");

    		const newMemoList = localStorageMemoList
    		? JSON.parse(localStorageMemoList)
    		: [];

    		newMemoList[$selectIndex].title = memoTitle;
    		newMemoList[$selectIndex].context = memoContext;
    		localStorage.setItem("memoList", JSON.stringify(newMemoList));
    		memoList.set(newMemoList);
    		backListPage(); // メモ一覧画面に戻る
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Detail> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => backListPage();

    	function input_input_handler() {
    		memoTitle = this.value;
    		$$invalidate(0, memoTitle);
    	}

    	function textarea_input_handler() {
    		memoContext = this.value;
    		$$invalidate(1, memoContext);
    	}

    	$$self.$capture_state = () => ({
    		memoList,
    		screenType,
    		selectIndex,
    		memoTitle,
    		memoContext,
    		backListPage,
    		updateMemo,
    		$selectIndex,
    		$memoList
    	});

    	$$self.$inject_state = $$props => {
    		if ('memoTitle' in $$props) $$invalidate(0, memoTitle = $$props.memoTitle);
    		if ('memoContext' in $$props) $$invalidate(1, memoContext = $$props.memoContext);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		memoTitle,
    		memoContext,
    		backListPage,
    		updateMemo,
    		click_handler,
    		input_input_handler,
    		textarea_input_handler
    	];
    }

    class Detail extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Detail",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.46.2 */
    const file = "src/App.svelte";

    // (17:29) 
    function create_if_block_1(ctx) {
    	let detail;
    	let current;
    	detail = new Detail({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(detail.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(detail, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(detail.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(detail.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(detail, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(17:29) ",
    		ctx
    	});

    	return block;
    }

    // (15:1) {#if $screenType === 0}
    function create_if_block(ctx) {
    	let list;
    	let current;
    	list = new List({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(list.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(list, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(list.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(list.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(list, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(15:1) {#if $screenType === 0}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let h1;
    	let t1;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block, create_if_block_1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*$screenType*/ ctx[0] === 0) return 0;
    		if (/*$screenType*/ ctx[0] === 1) return 1;
    		return -1;
    	}

    	if (~(current_block_type_index = select_block_type(ctx))) {
    		if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    	}

    	const block = {
    		c: function create() {
    			main = element("main");
    			h1 = element("h1");
    			h1.textContent = "メモアプリ";
    			t1 = space();
    			if (if_block) if_block.c();
    			add_location(h1, file, 13, 1, 303);
    			attr_dev(main, "class", "svelte-17k0dhw");
    			add_location(main, file, 12, 0, 295);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, h1);
    			append_dev(main, t1);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].m(main, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index !== previous_block_index) {
    				if (if_block) {
    					group_outros();

    					transition_out(if_blocks[previous_block_index], 1, 1, () => {
    						if_blocks[previous_block_index] = null;
    					});

    					check_outros();
    				}

    				if (~current_block_type_index) {
    					if_block = if_blocks[current_block_type_index];

    					if (!if_block) {
    						if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    						if_block.c();
    					}

    					transition_in(if_block, 1);
    					if_block.m(main, null);
    				} else {
    					if_block = null;
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);

    			if (~current_block_type_index) {
    				if_blocks[current_block_type_index].d();
    			}
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let $screenType;
    	validate_store(screenType, 'screenType');
    	component_subscribe($$self, screenType, $$value => $$invalidate(0, $screenType = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ screenType, List, Detail, $screenType });
    	return [$screenType];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
        target: document.body,
        props: {
            name: 'world'
        }
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
