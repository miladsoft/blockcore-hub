import { Injectable } from '@angular/core';
import { Logger } from './logger.service';

export interface Chain {
    test: boolean;
    name: string;
    coin?: string;
    chain: string;
    unit?: string;
    identity: string;
    tooltip: string;
    port?: number;
    rpcPort?: number;
    apiPort?: number;
    wsPort?: number;
    network: string;
    mode?: string;
    genesisDate?: Date;
    path?: string;
    datafolder?: string;

    private?: number;
    public?: number;
    rootFolderName: string;
    pos: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class ChainService {

    static singletonInstance: ChainService;

    public availableChains: Array<Chain>;

    constructor(private log: Logger) {

        if (!ChainService.singletonInstance) {

            /** Modify this collection to add additional chain support. */
            this.availableChains = [
                { pos: false, rootFolderName: 'bitcoin', test: false, name: 'Bitcoin', unit: 'BTC', chain: 'BTC', private: 128, public: 0, identity: 'bitcoin', tooltip: 'City Hub: Bitcoin', port: 8333, rpcPort: 8332, apiPort: 37220, wsPort: 4336, network: 'Main', genesisDate: new Date(2009, 1, 3) },
                { pos: false, rootFolderName: 'bitcoin', test: true, name: 'Bitcoin (Test)', chain: 'BTC', private: 128, public: 0, identity: 'bitcoin', tooltip: 'City Hub: Bitcoin', port: 18333, rpcPort: 18332, apiPort: 38220, wsPort: 4336, network: 'TestNet', genesisDate: new Date(2009, 1, 3) },
                { pos: true, rootFolderName: 'bcp', test: false, name: 'Blockcore Platform', chain: 'BCP', private: 125, public: 58, identity: 'bcp', tooltip: 'Blockcore Platform', port: 15001, rpcPort: 15002, apiPort: 15003, network: 'BCPMain', genesisDate: new Date(2021, 0, 17) },
                { pos: true, rootFolderName: 'bcp', test: true, name: 'Blockcore Platform (Test)', chain: 'BCP', private: 239, public: 111, identity: 'bcp', tooltip: 'Blockcore Platform', port: 25001, rpcPort: 25002, apiPort: 25003, network: 'BCPTest', genesisDate: new Date(2021, 0, 17) },
                { pos: true, rootFolderName: 'city', test: false, name: 'City Chain', unit: 'CITY', coin: 'City Coin', chain: 'CITY', private: 237, public: 28, identity: 'city', tooltip: 'City Hub', port: 4333, rpcPort: 4334, apiPort: 4335, wsPort: 4336, network: 'CityMain', genesisDate: new Date(2018, 9, 1) },
                { pos: true, rootFolderName: 'city', test: true, name: 'City Chain (RegTest)', unit: 'TCITY', chain: 'CITY', private: 194, public: 66, identity: 'city', tooltip: 'City Hub', port: 14333, rpcPort: 14334, apiPort: 14335, wsPort: 14336, network: 'CityRegTest', genesisDate: new Date(2018, 9, 1) },
                { pos: true, rootFolderName: 'city', test: true, name: 'City Chain (Test)', unit: 'TCITY', chain: 'CITY', private: 194, public: 66, identity: 'city', tooltip: 'City Hub', port: 24333, rpcPort: 24334, apiPort: 24335, wsPort: 24336, network: 'CityTest', genesisDate: new Date(2018, 9, 1) },
                { pos: true, rootFolderName: 'impleumx', test: false, name: 'ImpleumX', chain: 'IMPLX', private: 217, public: 76, identity: 'implx', tooltip: 'ImpleumX', port: 18105, rpcPort: 18104, apiPort: 18103, network: 'ImpleumXMain', genesisDate: new Date(2020, 11, 11) },
                { pos: true, rootFolderName: 'impleumxTest', test: true, name: 'ImpleumX (Test)', chain: 'IMPLX', private: 233, public: 104, identity: 'implx', tooltip: 'ImpleumX', port: 25001, rpcPort: 25002, apiPort: 25003, network: 'ImpleumXTest', genesisDate: new Date(2020, 11, 11) },
                { pos: true, rootFolderName: 'exos', test: false, name: 'OpenExO', chain: 'EXOS', private: 156, public: 28, identity: 'exos', tooltip: 'EXOS', port: 4562, rpcPort: 4561, apiPort: 39120, network: 'EXOSMain', genesisDate: new Date(2018, 3, 4) },
                { pos: true, rootFolderName: 'rutanio', test: false, name: 'Rutanio', chain: 'RUTA', private: 188, public: 60, identity: 'ruta', tooltip: 'RUTA', port: 6782, rpcPort: 6781, apiPort: 39220, network: 'RutanioMain', genesisDate: new Date(2019, 6, 28) },
                { pos: true, rootFolderName: 'x42', test: false, name: 'x42', chain: 'X42', private: 203, public: 75, identity: 'x42', tooltip: 'X42', port: 52342, rpcPort: 52343, apiPort: 42220, network: 'x42Main', genesisDate: new Date(2018, 7, 1) },
                { pos: true, rootFolderName: 'xds', test: false, name: 'XDS', chain: 'XDS', private: 128, public: 0, identity: 'xds', tooltip: 'XDS', port: 38333, rpcPort: 48333, apiPort: 48334, network: 'XdsMain', genesisDate: new Date(2020, 0, 2) },
                { pos: true, rootFolderName: 'stratis', test: false, name: 'Stratis', chain: 'STRAT', private: 191, public: 63, identity: 'stratis', tooltip: 'Stratis Core', port: 16178, rpcPort: 16174, apiPort: 37221, network: 'StratisMain', genesisDate: new Date(2016, 8, 6) },
                { pos: true, rootFolderName: 'stratis', test: true, name: 'Stratis (RegTest)', chain: 'STRAT', private: 193, public: 65, identity: 'stratis', tooltip: 'Stratis Core', port: 18444, rpcPort: 18442, apiPort: 37221, network: 'StratisRegTest', genesisDate: new Date(2017, 5, 16) },
                { pos: true, rootFolderName: 'stratis', test: true, name: 'Stratis (Test)', chain: 'STRAT', private: 193, public: 65, identity: 'stratis', tooltip: 'Stratis Core', port: 26178, rpcPort: 26174, apiPort: 38221, network: 'StratisTest', genesisDate: new Date(2017, 5, 4) },
            ];

            ChainService.singletonInstance = this;
        }

        return ChainService.singletonInstance;
    }

    /** Retrieves a configuration for a blockchain, including the right network name and ports. */
    getChain(network: string): Chain {
        const selectedChains = this.availableChains.filter(c => c.network === network);
        let selectedChain: Chain;

        if (selectedChains.length === 0) {
            this.log.error('The supplied coin parameter is invalid. First available chain selected as default. Argument value: ' + network);
            selectedChain = this.availableChains[0];
        } else {
            selectedChain = selectedChains[0];
        }

        return selectedChain;
    }
}
