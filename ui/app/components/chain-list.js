const Component = require('react').Component
const PropTypes = require('prop-types')
const h = require('react-hyperscript')
const inherits = require('util').inherits
const TokenTracker = require('eth-token-tracker')
const ChainInfo = require('./chain-info.js')
const connect = require('react-redux').connect
const selectors = require('../selectors')
const log = require('loglevel')

function mapStateToProps (state) {
  return {
    network: state.metamask.network,
    tokens: state.metamask.tokens,
    userAddress: selectors.getSelectedAddress(state),
  }
}

const defaultTokens = []
const contracts = require('eth-contract-metadata')
for (const address in contracts) {
  const contract = contracts[address]
  if (contract.erc20) {
    contract.address = address
    defaultTokens.push(contract)
  }
}

ChainList.contextTypes = {
  t: PropTypes.func,
}

module.exports = connect(mapStateToProps)(ChainList)


inherits(ChainList, Component)
function ChainList () {
  this.state = {
    tokens: [],
    isLoading: true,
    network: null,
  }
  Component.call(this)
}

ChainList.prototype.render = function () {
  const { userAddress } = this.props
  const state = this.state
  const { tokens, isLoading, error } = state

  if (isLoading) {
    return this.message(this.context.t('loadingTokens'))
  }

  if (error) {
    log.error(error)
    return h('.hotFix', {
      style: {
        padding: '80px',
      },
    }, [
      this.context.t('troubleTokenBalances'),
      h('span.hotFix', {
        style: {
          color: 'rgba(247, 134, 28, 1)',
          cursor: 'pointer',
        },
        onClick: () => {
          global.platform.openWindow({
          url: `https://ethplorer.io/address/${userAddress}`,
        })
        },
      }, this.context.t('here')),
    ])
  }

  return h('div', tokens.map((tokenData) => h(ChainInfo, tokenData)))

}

ChainList.prototype.message = function (body) {
  return h('div', {
    style: {
      display: 'flex',
      height: '250px',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '30px',
    },
  }, body)
}

ChainList.prototype.componentDidMount = function () {
  this.createFreshTokenTracker()
}

ChainList.prototype.createFreshTokenTracker = function () {
  if (this.tracker) {
    // Clean up old trackers when refreshing:
    this.tracker.stop()
    this.tracker.removeListener('update', this.balanceUpdater)
    this.tracker.removeListener('error', this.showError)
  }

  if (!global.ethereumProvider) return
  const { userAddress } = this.props

  this.tracker = new TokenTracker({
    userAddress,
    provider: global.ethereumProvider,
    tokens: this.props.tokens,
    pollingInterval: 10000,
  })


  // Set up listener instances for cleaning up
  this.balanceUpdater = this.updateBalances.bind(this)
  this.showError = (error) => {
    this.setState({ error, isLoading: false })
  }
  this.tracker.on('update', this.balanceUpdater)
  this.tracker.on('error', this.showError)

  this.tracker.updateBalances()
  .then(() => {
    this.updateBalances(this.tracker.serialize())
  })
  .catch((reason) => {
    log.error(`Problem updating balances`, reason)
    this.setState({ isLoading: false })
  })
}

ChainList.prototype.componentDidUpdate = function (nextProps) {
  const {
    network: oldNet,
    userAddress: oldAddress,
    tokens,
  } = this.props
  const {
    network: newNet,
    userAddress: newAddress,
    tokens: newTokens,
  } = nextProps

  const isLoading = newNet === 'loading'
  const missingInfo = !oldNet || !newNet || !oldAddress || !newAddress
  const sameUserAndNetwork = oldAddress === newAddress && oldNet === newNet
  const shouldUpdateTokens = isLoading || missingInfo || sameUserAndNetwork

  const oldTokensLength = tokens ? tokens.length : 0
  const tokensLengthUnchanged = oldTokensLength === newTokens.length

  if (tokensLengthUnchanged && shouldUpdateTokens) return

  this.setState({ isLoading: true })
  this.createFreshTokenTracker()
}

// Should be update to only load the subchain balances
ChainList.prototype.updateBalances = function (tokens) {
  this.setState({ tokens, isLoading: false })
}

ChainList.prototype.componentWillUnmount = function () {
  if (!this.tracker) return
  this.tracker.stop()
}

