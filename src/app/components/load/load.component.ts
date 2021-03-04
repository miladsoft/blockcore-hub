/* eslint-disable */

import { Component, ViewEncapsulation, HostBinding, NgZone, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { AuthenticationService } from '../../services/authentication.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ApplicationStateService } from '../../services/application-state.service';
import * as signalR from '@aspnet/signalr';
import { ApiService } from '../../services/api.service';
import { delay, retryWhen, tap } from 'rxjs/operators';
import { Logger } from '../../services/logger.service';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { NodeStatus } from '@models/node-status';
import { ElectronService } from 'ngx-electron';
import { environment } from 'src/environments/environment';
import * as coininfo from 'city-coininfo';
import { Chain, ChainService } from 'src/app/services/chain.service';
import { StorageService } from 'src/app/services/storage.service';

export interface ListItem {
    name: string;
    id: string;
}

@Component({
    selector: 'app-load',
    templateUrl: './load.component.html',
    styleUrls: ['./load.component.scss'],
    encapsulation: ViewEncapsulation.None
})
export class LoadComponent implements OnInit, OnDestroy {
    @HostBinding('class.load') hostClass = true;

    selectedMode: ListItem;
    // selectedNetwork: Chain;
    loading: boolean;
    hasWallet = false;
    modes: ListItem[] = [];
    networks: ListItem[] = [];
    remember: boolean;
    connection: signalR.HubConnection;
    delayed = false;
    apiSubscription: any;
    routingSubscription: any;
    // dataFolder: string;
    // nodePath: string;

    private subscription: Subscription;
    private statusIntervalSubscription: Subscription;
    private readonly TryDelayMilliseconds = 3000;
    private readonly MaxRetryCount = 50;
    loadingFailed = false;
    public apiConnected = false;
    private ipc: Electron.IpcRenderer;

    constructor(
        private route: ActivatedRoute,
        private http: HttpClient,
        private authService: AuthenticationService,
        private electronService: ElectronService,
        private router: Router,
        public chains: ChainService,
        private log: Logger,
        private zone: NgZone,
        private readonly cd: ChangeDetectorRef,
        private apiService: ApiService,
        private storage: StorageService,
        public appState: ApplicationStateService) {

        this.modes = [
            { id: 'full', name: 'Full' },
        ];

        debugger;

        if (!environment.production) {
            this.modes.push(
                // { id: 'demo', name: 'Demo' }, // Auto-wallet creation, etc.
                { id: 'local', name: 'Custom' }, // Launches the daemon by specifying path to .dll file.
                { id: 'manual', name: 'Manual' }, // Manual startup of daemon, does not send shutdown messages. Useful when you debug node with Visual Studio.
                { id: 'simple', name: 'Mobile' }); // API Wallet mode.
            // { id: 'light', name: 'Light' }, // Full Node in Purge mode and other features disabled.
            // { id: 'pos', name: 'Point-of-Sale (POS)' },
            // { id: 'readonly', name: 'Read-only' });
        }

        this.selectedMode = this.modes.find(mode => mode.id === this.appState.daemon.mode);

        if (this.appState.isChangingToChain) {
            // If the user has selected a new chain to change to, just do it automatically.
            this.appState.activeChain = this.appState.changeToChain;

            // Important to update this, it will be used by API Service to initialize the correct node daemon.
            this.appState.daemon.network = this.appState.activeChain.network;

            // this.appState.changeToChain = null;

            // if (this.appState.changeToChain) {

            //     this.appState.changeToChain = null;
            // }
        }
        else {
            // Make sure that the chain setup is available in the appstate.
            this.appState.activeChain = this.chains.availableChains.find(network => network.network === this.appState.daemon.network);
        }

        this.remember = true;

        this.log.info('Mode:', this.selectedMode);
        this.log.info('Network:', this.appState.activeChain);
        this.log.info('Daemon App State:', JSON.stringify(this.appState.daemon));

        this.ipc = electronService.ipcRenderer;

        this.ipc.on('choose-data-folder', (event, path: string) => {
            // notificationService.show({ title: 'Checking for update...', body: JSON.stringify(info) });
            console.log('choose-data-folder: ', path);
            this.appState.daemon.datafolder = path;

            // We must force a detection here to make it update immediately.
            this.cd.detectChanges();
        });

        this.ipc.on('choose-node-path', (event, path: string) => {
            // notificationService.show({ title: 'Checking for update...', body: JSON.stringify(info) });
            console.log('choose-node-path: ', path);
            // this.nodePath = path;
            this.appState.daemon.path = path;

            // We must force a detection here to make it update immediately.
            this.cd.detectChanges();
        });
    }

    initialize() {
        debugger;

        this.apiService.initialize();

        // TODO: Should send the correct network, hard-coded to city main for now.
        // Do this always now, we need this information in the UI for identity handling.
        // const network = coininfo('city').toBitcoinJS();
        // this.appState.networkDefinition = network;

        this.appState.networkParams = {
            private: this.appState.activeChain.private, // WIF
            public: this.appState.activeChain.public // PubKeyHash
        };

        // this.appState.networkParams = {
        //     private: network.wif,
        //     public: network.pubKeyHash
        // };

        console.log('INITILIZE!....', this.appState.daemon);
        console.log(this.appState);

        // Update the overlay icon to visualize current chain.
        this.electronService.ipcRenderer.send('update-icon', { icon: '/src/assets/' + this.appState.chain + '/logo.png', title: this.appState.chain });

        if (this.appState.daemon.mode === 'full' || this.appState.daemon.mode === 'local' || this.appState.daemon.mode === 'light') {
            this.loading = true;
            this.appState.connected = false;
            this.cd.detectChanges();
            this.fullNodeConnect();
        } else if (this.appState.daemon.mode === 'manual') {
            this.loading = false;
            this.appState.connected = true;
            this.cd.detectChanges();
            this.fullNodeConnect();
        } else if (this.appState.daemon.mode === 'simple') {
            // TODO: Should send the correct network, hard-coded to city main for now.
            // const network = coininfo('city').toBitcoinJS();
            // this.appState.networkDefinition = network;

            // this.appState.networkParams = {
            //     private: network.wif,
            //     public: network.pubKeyHash
            // };

            this.loading = false;
            this.appState.connected = true;
            this.router.navigateByUrl('/login');
        }
    }

    get listTestNetworks(): boolean {
        return this.storage.getValue('Network:ListTestNetworks') === 'true';
    }

    set listTestNetworks(value: boolean) {
        this.storage.setValue('Network:ListTestNetworks', value.toString());
    }

    get filteredAvailableChains() {
        return this.listTestNetworks ?
            this.chains.availableChains :
            this.chains.availableChains.filter(language => !language.test);
    }

    onDaemonFolderChange(event) {
        this.log.info('Daemon folder changed:', event);

        if (event.target.files.length > 0) {
            this.appState.daemon.path = event.target.files[0].path;
        } else {
            this.appState.daemon.path = '';
        }
    }

    chooseNodeExecutable() {
        this.electronService.ipcRenderer.send('choose-node-path');
    }

    clearNodePath() {
        this.appState.daemon.path = '';
    }

    chooseDataFolder() {
        this.electronService.ipcRenderer.send('choose-data-folder');
    }

    clearDataFolder() {
        this.appState.daemon.datafolder = '';
    }

    onDataFolderChange(event) {
        this.log.info('Data folder changed:', event);

        if (event.target.files.length > 0) {
            this.appState.daemon.datafolder = event.target.files[0].path;
        } else {
            this.appState.daemon.datafolder = '';
        }
    }

    launch() {
        this.appState.updateNetworkSelection(this.remember, this.selectedMode.id, this.appState.activeChain.network, this.appState.daemon.path, this.appState.daemon.datafolder);

        // If the selected mode is not 'local', we'll reset the path and data folder.
        if (this.appState.daemon.mode !== 'local') {
            localStorage.removeItem('Network:Path');
            localStorage.removeItem('Network:DataFolder');
        }

        this.initialize();
    }

    fullNodeConnect() {
        // Do we need to keep a pointer to this timeout and remove it, or does the zone handle that?
        this.zone.run(() => {
            setTimeout(() => {
                this.delayed = true;
            }, 60000); // 60000 Make sure it is fairly high, we don't want users to immediatly perform advanced reset options when they don't need to.
        });

        this.tryStart();
    }

    // Attempts to initialise the wallet by contacting the daemon.  Will try to do this MaxRetryCount times.
    private tryStart() {
        let retry = 0;
        const stream$ = this.apiService.getNodeStatus().pipe(
            retryWhen(errors =>
                errors.pipe(delay(this.TryDelayMilliseconds)).pipe(
                    tap(errorStatus => {
                        if (retry++ === this.MaxRetryCount) {
                            throw errorStatus;
                        }
                        this.log.info(`Retrying ${retry}...`);
                    })
                )
            )
        );

        this.subscription = stream$.subscribe(
            (data: NodeStatus) => {
                this.apiConnected = true;
                this.statusIntervalSubscription = this.apiService.getNodeStatusInterval()
                    .subscribe(
                        response => {
                            let statusResponse = response.featuresData.filter(x => x.namespace === 'Blockcore.Base.BaseFeature');
                            if (statusResponse.length > 0 && statusResponse[0].state === 'Initialized') {
                                this.statusIntervalSubscription.unsubscribe();
                                this.start();
                            }

                            // TODO: Remove this when Stratis based node is removed.
                            statusResponse = response.featuresData.filter(x => x.namespace === 'Stratis.Bitcoin.Base.BaseFeature');
                            if (statusResponse.length > 0 && statusResponse[0].state === 'Initialized') {
                                this.statusIntervalSubscription.unsubscribe();
                                this.start();
                            }
                        }
                    );
            }, (error: any) => {
                this.log.info('Failed to start wallet');
                this.loading = false;
                this.loadingFailed = true;
            }
        );
    }

    start() {
        // this.simpleWalletConnect();
        // We have successful connection with daemon, make sure we inform the main process of |.
        this.electronService.ipcRenderer.send('daemon-started');

        this.loading = false;
        this.appState.connected = true;
        this.router.navigateByUrl('/login');
    }

    ngOnInit() {
        this.routingSubscription = this.route
            .queryParams
            .subscribe(params => {
                debugger;
                if (params.loading) {
                    this.loading = true;
                    this.loadingFailed = false;
                    this.appState.connected = false;
                } else {
                    this.loading = false;
                }

                if (params.changing) {
                    // this.initialize();
                }
            });

        debugger;

        // this.unsubscribe(); // Make sure we unsubscribe existing listeners.

        // this.launch();
        // this.initialize();
        // }
        // else {
        //     const existingMode = localStorage.getItem('Network:Mode');

        //     // If user has choosen to remember mode, we'll redirect directly to login, when connected.
        //     if (existingMode != null) {
        //         this.initialize();
        //     }
        // }

        if (this.appState.changeToChain && this.appState.isChangingToChain) {
            // this.appState.changeToChain = null;
            this.appState.isChangingToChain = false;
            this.initialize();
        }

        const existingMode = localStorage.getItem('Network:Mode');

        // If user has choosen to remember mode, we'll redirect directly to login, when connected.
        if (existingMode != null) {
            this.initialize();
        }
    }

    ngOnDestroy() {
        this.unsubscribe();
    }

    unsubscribe() {
        if (this.routingSubscription) {
            this.routingSubscription.unsubscribe();
        }

        if (this.apiSubscription) {
            this.apiSubscription.unsubscribe();
        }
    }

    cancel() {
        this.unsubscribe();

        this.appState.connected = false;
        this.loading = false;
        this.delayed = false;
        this.appState.daemon.mode = null;
    }

    simpleWalletConnect() {
        this.connection = new signalR.HubConnectionBuilder()
            .withUrl('http://localhost:4337/node')
            .build();

        this.connection.on('BlockConnected', (block) => {
            console.log('BlockConnected:' + block);
        });

        this.connection.on('TransactionReceived', (trx) => {
            console.log('TransactionReceived:' + trx);
        });

        this.connection.on('txs', (transactions) => {
            console.log(transactions);
            // TODO: Update a bitcore-lib fork to add support for Stratis/City Chain.
            // var tx1 = transactions[0];
            // var tx = bitcoin.Transaction.fromHex(tx1.value.hex);
        });

        const self = this;
        // Transport fallback functionality is now built into start.
        this.connection.start()
            .then(() => {
                console.log('connection started');
                self.connection.send('Subscribe', { events: ['TransactionReceived', 'BlockConnected'] });
            })
            .catch(error => {
                console.error(error.message);
            });
    }
}
