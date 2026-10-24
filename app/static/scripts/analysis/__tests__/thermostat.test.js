import {
    Thermostat,
    THERMOSTAT_FAULTY,
    THERMOSTAT_OPEN_TEMPERATURE,
    THERMOSTAT_WORKING
} from '../thermostat.js';

describe('Thermostat', () => {
    let thermostat;
    let mockDataframes;

    beforeEach(() => {
        thermostat = new Thermostat();
        mockDataframes = [
            {
                _80x00_Time: '2024-01-01T00:00:00Z',
                _80x03_CoolantTemp: 20
            },
            {
                _80x00_Time: '2024-01-01T00:00:10Z',
                _80x03_CoolantTemp: 25
            },
            {
                _80x00_Time: '2024-01-01T00:00:20Z',
                _80x03_CoolantTemp: 30
            }
        ];
    });

    describe('update', () => {
        it('should update the thermostat state with new dataframes', () => {
            thermostat.update(mockDataframes);
            expect(thermostat._maxTemperatureDataframe.value).toBe(30);
        });
    });

    describe('isFaulty', () => {
        it('should return THERMOSTAT_WORKING when engine is too cold', () => {
            thermostat.update(mockDataframes);
            expect(thermostat.isFaulty()).toBe(THERMOSTAT_WORKING);
        });

        it('should return THERMOSTAT_WORKING when too early to diagnose', () => {
            const warmDataframes = [
                {
                    _80x00_Time: '2024-01-01T00:00:00Z',
                    _80x03_CoolantTemp: THERMOSTAT_OPEN_TEMPERATURE + 1
                },
                {
                    _80x00_Time: '2024-01-01T00:00:10Z',
                    _80x03_CoolantTemp: THERMOSTAT_OPEN_TEMPERATURE - 1
                }
            ];
            thermostat.update(warmDataframes);
            expect(thermostat.isFaulty()).toBe(THERMOSTAT_WORKING);
        });

        it('should return THERMOSTAT_WORKING when thermostat opens correctly', () => {
            const dataframes = [
                {
                    _80x00_Time: '2024-01-01T00:00:00Z',
                    _80x03_CoolantTemp: THERMOSTAT_OPEN_TEMPERATURE + 10
                },
                {
                    _80x00_Time: '2024-01-01T00:00:10Z',
                    _80x03_CoolantTemp: THERMOSTAT_OPEN_TEMPERATURE + 5
                }
            ];
            thermostat.update(dataframes);
            expect(thermostat.isFaulty()).toBe(THERMOSTAT_WORKING);
        });

        it('should return THERMOSTAT_FAULTY when thermostat fails to open', () => {
            const dataframes = [
                {
                    _80x00_Time: '2024-01-01T00:00:00Z',
                    _80x03_CoolantTemp: THERMOSTAT_OPEN_TEMPERATURE + 10
                },
                {
                    _80x00_Time: '2024-01-01T00:00:10Z',
                    _80x03_CoolantTemp: THERMOSTAT_OPEN_TEMPERATURE + 10
                }
            ];
            thermostat.update(dataframes);
            expect(thermostat.isFaulty()).toBe(THERMOSTAT_FAULTY);
        });
    });

    describe('_getPeakTemperature', () => {
        it('should return the highest temperature reading', () => {
            const result = thermostat._getPeakTemperature(mockDataframes);
            expect(result.value).toBe(30);
        });
    });

    describe('_hasThermostatOpened', () => {
        it('should return true when temperature drops after peak', () => {
            const dataframes = [
                {
                    _80x00_Time: '2024-01-01T00:00:00Z',
                    _80x03_CoolantTemp: THERMOSTAT_OPEN_TEMPERATURE + 10
                },
                {
                    _80x00_Time: '2024-01-01T00:00:10Z',
                    _80x03_CoolantTemp: THERMOSTAT_OPEN_TEMPERATURE + 5
                }
            ];
            thermostat.update(dataframes);
            expect(thermostat._hasThermostatOpened()).toBe(true);
        });

        it('should return false when temperature is still rising', () => {
            const dataframes = [
                {
                    _80x00_Time: '2024-01-01T00:00:00Z',
                    _80x03_CoolantTemp: THERMOSTAT_OPEN_TEMPERATURE + 10
                },
                {
                    _80x00_Time: '2024-01-01T00:00:10Z',
                    _80x03_CoolantTemp: THERMOSTAT_OPEN_TEMPERATURE + 15
                }
            ];
            thermostat.update(dataframes);
            expect(thermostat._hasThermostatOpened()).toBe(false);
        });
    });
}); 