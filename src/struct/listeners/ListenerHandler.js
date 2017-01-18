const path = require('path');
const rread = require('readdir-recursive');
const EventEmitter = require('events');
const Collection = require('discord.js').Collection;
const Listener = require('./Listener');

class ListenerHandler {
    /**
     * Loads Listeners and register them with EventEmitters.
     * @param {Framework} framework - The Akairo framework.
     * @param {Object} options - Options from framework.
     */
    constructor(framework, options){
        /**
         * The Akairo framework.
         * @readonly
         * @type {Framework}
         */
        this.framework = framework;

        /**
         * Directory to listeners.
         * @readonly
         * @type {string}
         */
        this.directory = path.resolve(options.listenerDirectory);

        /**
         * Listeners loaded, mapped by ID to Listener.
         * @type {Collection.<string, Listener>}
         */
        this.listeners = new Collection();

        let filepaths = rread.fileSync(this.directory);
        filepaths.forEach(filepath => {
            this.load(filepath);
        });
    }

    /**
     * Loads a Listener.
     * @param {string} filepath - Path to file.
     */
    load(filepath){
        let listener = require(filepath);

        if (!(listener instanceof Listener)) return;
        if (this.listeners.has(listener.id)) throw new Error(`Listener ${listener.id} already loaded.`);

        listener.filepath = filepath;
        listener.framework = this.framework;
        listener.client = this.framework.client;
        listener.listenerHandler = this;

        this.listeners.set(listener.id, listener);
        this.registerListener(listener.id);
    }

    /**
     * Adds a Listener.
     * @param {string} filename - Filename to lookup in the directory.
     */
    add(filename){
        let files = rread.fileSync(this.directory);
        let filepath = files.find(file => file.endsWith(`${filename}.js`));

        if (!filepath){
            throw new Error(`File ${filename} not found.`);
        }

        this.load(filepath);
    }

    /**
     * Removes a Listener.
     * @param {string} id - ID of the Listener.
     */
    remove(id){
        let listener = this.listeners.get(id);
        if (!listener) throw new Error(`Listener ${id} does not exist.`);

        delete require.cache[require.resolve(listener.filepath)];
        this.deregisterListener(listener.id);
        this.listeners.delete(listener.id);
    }

    /**
     * Reloads a Listener.
     * @param {string} id - ID of the Listener.
     */
    reload(id){
        let listener = this.listeners.get(id);
        if (!listener) throw new Error(`Listener ${id} does not exist.`);

        let filepath = listener.filepath;

        delete require.cache[require.resolve(listener.filepath)];
        this.deregisterListener(listener.id);
        this.listeners.delete(listener.id);
        
        this.load(filepath);
    }
    
    /**
     * Registers a Listener with the EventEmitter.
     * @param {string} id - ID of the Listener.
     */
    registerListener(id){
        let listener = this.listeners.get(id);
        if (!listener) throw new Error(`Listener ${id} does not exist.`);

        let emitters = {
            client: this.framework.client,
            commandHandler: this.framework.commandHandler
        };

        let emitter = listener.emitter instanceof EventEmitter ? listener.emitter : emitters[listener.emitter];
        if (!(emitter instanceof EventEmitter)) throw new Error('Listener\'s emitter is not an EventEmitter');

        if (listener.type === 'once'){
            return emitter.once(listener.eventName, listener.exec);
        }

        emitter.on(listener.eventName, listener.exec);
    }

    /**
     * Removes a Listener from the EventEmitter.
     * @param {string} id - ID of the Listener.
     */
    deregisterListener(id){
        let listener = this.listeners.get(id);
        if (!listener) throw new Error(`Listener ${id} does not exist.`);

        let emitters = {
            client: this.framework.client,
            commandHandler: this.framework.commandHandler
        };

        let emitter = listener.emitter instanceof EventEmitter ? listener.emitter : emitters[listener.emitter];
        if (!(emitter instanceof EventEmitter)) throw new Error('Listener\'s emitter is not an EventEmitter');

        emitter.removeListener(listener.eventName, listener.exec);
    }
}

module.exports = ListenerHandler;