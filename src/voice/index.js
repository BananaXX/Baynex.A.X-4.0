// src/voice/index.js
const BaynexaVoiceAssistant = require('./VoiceAssistant');

module.exports = {
    BaynexaVoiceAssistant,
    
    // Factory function for easy initialization
    createVoiceAssistant: (config = {}) => {
        return new BaynexaVoiceAssistant(config);
    },
    
    // Default configurations
    configs: {
        professional: {
            voiceMode: 'smart',
            personality: 'professional',
            language: 'en-US'
        },
        friendly: {
            voiceMode: 'full',
            personality: 'friendly',
            language: 'en-US'
        },
        analytical: {
            voiceMode: 'smart',
            personality: 'analytical',
            language: 'en-US'
        },
        silent: {
            voiceMode: 'silent',
            personality: 'professional',
            language: 'en-US'
        }
    }
};
